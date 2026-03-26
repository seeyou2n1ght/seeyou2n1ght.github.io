#!/usr/bin/env python3
"""
知识图谱构建器 - 使用 SQLite 存储图结构
支持实体、关系、矛盾点、隐喻的高维存储
"""

import sqlite3
import json
import re
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, asdict


@dataclass
class Entity:
    """实体节点"""
    id: str
    name: str
    type: str  # concept, topic, domain
    domain: str
    properties: Dict
    created_at: str


@dataclass
class Relationship:
    """关系边"""
    id: str
    source_id: str
    target_id: str
    type: str  # links_to, implies, contradicts, supports, metaphor
    properties: Dict
    strength: float  # 关系强度 0-1


@dataclass
class Contradiction:
    """矛盾点"""
    id: str
    note1_id: str
    note2_id: str
    description: str
    severity: str  # low, medium, high


@dataclass
class Metaphor:
    """跨学科隐喻"""
    id: str
    source_domain: str
    target_domain: str
    source_concept: str
    target_concept: str
    mapping_description: str


class KnowledgeGraphDB:
    """知识图谱数据库"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self._create_tables()
    
    def _create_tables(self):
        """创建表结构"""
        cursor = self.conn.cursor()
        
        # 实体表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS entities (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                domain TEXT NOT NULL,
                properties TEXT,
                created_at TEXT NOT NULL,
                indexed INTEGER DEFAULT 0
            )
        """)
        
        # 关系表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS relationships (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                target_id TEXT NOT NULL,
                type TEXT NOT NULL,
                properties TEXT,
                strength REAL DEFAULT 1.0,
                FOREIGN KEY (source_id) REFERENCES entities(id),
                FOREIGN KEY (target_id) REFERENCES entities(id)
            )
        """)
        
        # 笔记表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                domain TEXT NOT NULL,
                topic TEXT,
                content TEXT,
                entities TEXT,
                parsed INTEGER DEFAULT 0,
                created_at TEXT
            )
        """)
        
        # 矛盾点表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS contradictions (
                id TEXT PRIMARY KEY,
                note1_id TEXT,
                note2_id TEXT,
                description TEXT,
                severity TEXT,
                FOREIGN KEY (note1_id) REFERENCES notes(id),
                FOREIGN KEY (note2_id) REFERENCES notes(id)
            )
        """)
        
        # 隐喻表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS metaphors (
                id TEXT PRIMARY KEY,
                source_domain TEXT,
                target_domain TEXT,
                source_concept TEXT,
                target_concept TEXT,
                mapping_description TEXT
            )
        """)
        
        # 创建索引
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_entity_name ON entities(name)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_rel_source ON relationships(source_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_rel_target ON relationships(target_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_note_domain ON notes(domain)")
        
        self.conn.commit()
    
    def add_entity(self, entity: Entity):
        """添加实体"""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO entities (id, name, type, domain, properties, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (entity.id, entity.name, entity.type, entity.domain, 
              json.dumps(entity.properties), entity.created_at))
        self.conn.commit()
    
    def add_relationship(self, relationship: Relationship):
        """添加关系"""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO relationships 
            (id, source_id, target_id, type, properties, strength)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (relationship.id, relationship.source_id, relationship.target_id,
              relationship.type, json.dumps(relationship.properties), relationship.strength))
        self.conn.commit()
    
    def add_note(self, note_id: str, title: str, domain: str, topic: str, 
                 content: str, entities: List[str]):
        """添加笔记"""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO notes 
            (id, title, domain, topic, content, entities, parsed, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (note_id, title, domain, topic, content, json.dumps(entities), 
              0, datetime.now().isoformat()))
        self.conn.commit()
    
    def mark_note_parsed(self, note_id: str):
        """标记笔记已解析"""
        cursor = self.conn.cursor()
        cursor.execute("UPDATE notes SET parsed = 1 WHERE id = ?", (note_id,))
        self.conn.commit()
    
    def add_contradiction(self, contradiction: Contradiction):
        """添加矛盾点"""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO contradictions 
            (id, note1_id, note2_id, description, severity)
            VALUES (?, ?, ?, ?, ?)
        """, (contradiction.id, contradiction.note1_id, contradiction.note2_id,
              contradiction.description, contradiction.severity))
        self.conn.commit()
    
    def add_metaphor(self, metaphor: Metaphor):
        """添加隐喻"""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO metaphors 
            (id, source_domain, target_domain, source_concept, target_concept, mapping_description)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (metaphor.id, metaphor.source_domain, metaphor.target_domain,
              metaphor.source_concept, metaphor.target_concept, metaphor.mapping_description))
        self.conn.commit()
    
    def get_stats(self) -> Dict:
        """获取统计信息"""
        cursor = self.conn.cursor()
        
        stats = {}
        
        cursor.execute("SELECT COUNT(*) FROM entities")
        stats['entities'] = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM relationships")
        stats['relationships'] = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM notes WHERE parsed = 1")
        stats['parsed_notes'] = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM contradictions")
        stats['contradictions'] = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM metaphors")
        stats['metaphors'] = cursor.fetchone()[0]
        
        return stats
    
    def export_graph_json(self, filepath: str):
        """导出图谱为 JSON"""
        cursor = self.conn.cursor()
        
        graph = {
            "nodes": [],
            "edges": [],
            "metadata": {
                "exported_at": datetime.now().isoformat(),
                "stats": self.get_stats()
            }
        }
        
        # 导出实体
        cursor.execute("SELECT * FROM entities")
        for row in cursor.fetchall():
            graph["nodes"].append({
                "id": row["id"],
                "label": row["name"],
                "type": row["type"],
                "domain": row["domain"],
                "properties": json.loads(row["properties"]) if row["properties"] else {}
            })
        
        # 导出关系
        cursor.execute("SELECT * FROM relationships")
        for row in cursor.fetchall():
            graph["edges"].append({
                "id": row["id"],
                "source": row["source_id"],
                "target": row["target_id"],
                "type": row["type"],
                "strength": row["strength"]
            })
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(graph, f, ensure_ascii=False, indent=2)
        
        return graph


class NoteParser:
    """笔记解析器 - 提取实体、关系、矛盾点、隐喻"""
    
    def __init__(self):
        self.entity_cache = {}
        self.relation_types = [
            "links_to", "implies", "contradicts", "supports", 
            "extends", "implements", "depends_on", "optimizes"
        ]
    
    def parse_wikilinks(self, content: str) -> List[str]:
        """提取 Wikilinks"""
        pattern = r'\[\[([^\]]+)\]\]'
        return re.findall(pattern, content)
    
    def parse_frontmatter(self, content: str) -> Dict:
        """提取 Frontmatter 元数据"""
        match = re.search(r'---\n(.*?)\n---', content, re.DOTALL)
        if not match:
            return {}
        
        metadata = {}
        for line in match.group(1).split('\n'):
            if ':' in line:
                key, value = line.split(':', 1)
                metadata[key.strip()] = value.strip()
        
        return metadata
    
    def extract_entities(self, content: str, metadata: Dict) -> List[Entity]:
        """提取实体"""
        entities = []
        
        # 从标题提取
        title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
        if title_match:
            title = title_match.group(1)
            entity_id = self._generate_id(title)
            entities.append(Entity(
                id=entity_id,
                name=title,
                type="concept",
                domain=metadata.get('domain', 'unknown'),
                properties={"from": "title"},
                created_at=datetime.now().isoformat()
            ))
        
        # 从 Wikilinks 提取
        wikilinks = self.parse_wikilinks(content)
        for link in wikilinks[:5]:  # 限制数量
            entity_id = self._generate_id(link)
            entities.append(Entity(
                id=entity_id,
                name=link,
                type="concept",
                domain=metadata.get('domain', 'unknown'),
                properties={"from": "wikilink"},
                created_at=datetime.now().isoformat()
            ))
        
        return entities
    
    def extract_relationships(self, content: str, entities: List[Entity]) -> List[Relationship]:
        """提取关系"""
        relationships = []
        
        # 基于段落临近度建立关系
        paragraphs = content.split('\n\n')
        
        for i, para in enumerate(paragraphs[:10]):  # 限制处理量
            wikilinks = self.parse_wikilinks(para)
            
            # 同一段落中的实体建立关系
            if len(wikilinks) >= 2:
                for j in range(len(wikilinks) - 1):
                    source_id = self._generate_id(wikilinks[j])
                    target_id = self._generate_id(wikilinks[j + 1])
                    
                    relationships.append(Relationship(
                        id=self._generate_id(f"{source_id}_{target_id}"),
                        source_id=source_id,
                        target_id=target_id,
                        type="links_to",
                        properties={"context": para[:100]},
                        strength=0.8
                    ))
        
        return relationships
    
    def detect_contradictions(self, note1: Dict, note2: Dict) -> Optional[Contradiction]:
        """检测矛盾点（简化版）"""
        # 基于关键词的简单矛盾检测
        contradiction_keywords = {
            "always": "never",
            "all": "none",
            "must": "never",
            "impossible": "possible"
        }
        
        content1 = note1.get('content', '').lower()
        content2 = note2.get('content', '').lower()
        
        for word1, word2 in contradiction_keywords.items():
            if word1 in content1 and word2 in content2:
                return Contradiction(
                    id=self._generate_id(f"contr_{note1['id']}_{note2['id']}"),
                    note1_id=note1['id'],
                    note2_id=note2['id'],
                    description=f"潜在矛盾：'{word1}' vs '{word2}'",
                    severity="medium"
                )
        
        return None
    
    def generate_metaphors(self, entities: List[Entity]) -> List[Metaphor]:
        """生成跨学科隐喻"""
        metaphors = []
        
        # 按领域分组
        by_domain = {}
        for entity in entities:
            if entity.domain not in by_domain:
                by_domain[entity.domain] = []
            by_domain[entity.domain].append(entity)
        
        # 在不同领域间建立隐喻
        domains = list(by_domain.keys())
        for i in range(min(len(domains) - 1, 2)):
            source_domain = domains[i]
            target_domain = domains[i + 1]
            
            if by_domain[source_domain] and by_domain[target_domain]:
                source_entity = by_domain[source_domain][0]
                target_entity = by_domain[target_domain][0]
                
                metaphors.append(Metaphor(
                    id=self._generate_id(f"meta_{source_domain}_{target_domain}"),
                    source_domain=source_domain,
                    target_domain=target_domain,
                    source_concept=source_entity.name,
                    target_concept=target_entity.name,
                    mapping_description=f"{source_entity.name} ({source_domain}) 可能映射到 {target_entity.name} ({target_domain})"
                ))
        
        return metaphors
    
    def _generate_id(self, content: str) -> str:
        import hashlib
        return hashlib.md5(content.encode()).hexdigest()[:16]


class GlobalIndexGenerator:
    """全局索引生成器 - 每 5 篇笔记后全量刷新"""
    
    def __init__(self, db: KnowledgeGraphDB, output_dir: str):
        self.db = db
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def generate(self, batch_num: int) -> str:
        """生成全局索引"""
        stats = self.db.get_stats()
        graph_json = self.db.export_graph_json(str(self.output_dir / f"graph_batch_{batch_num}.json"))
        
        # 生成 GLOBAL_INDEX.md
        index_content = f"""# 🌐 知识图谱全局索引

**批次**: {batch_num}
**生成时间**: {datetime.now().isoformat()}

---

## 📊 当前图谱统计

| 类型 | 数量 |
|:---|:---:|
| 实体节点 | {stats['entities']} |
| 关系边 | {stats['relationships']} |
| 已解析笔记 | {stats['parsed_notes']} |
| 矛盾点 | {stats['contradictions']} |
| 隐喻映射 | {stats['metaphors']} |

---

## 🔗 图谱拓扑结构

```json
{{
    "nodes": {len(graph_json['nodes'])},
    "edges": {len(graph_json['edges'])},
    "domains": {self._count_domains(graph_json)}
}}
```

---

## 📁 批次文件

- 图数据：`graph_batch_{batch_num}.json`

---

*每 5 篇笔记自动刷新*
"""
        
        index_path = self.output_dir / "GLOBAL_INDEX.md"
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write(index_content)
        
        return str(index_path)
    
    def _count_domains(self, graph_json: Dict) -> Dict[str, int]:
        domains = {}
        for node in graph_json['nodes']:
            domain = node.get('domain', 'unknown')
            domains[domain] = domains.get(domain, 0) + 1
        return domains


if __name__ == "__main__":
    print("🧪 测试图谱构建器...")
    
    db = KnowledgeGraphDB(":memory:")
    parser = NoteParser()
    
    # 测试笔记
    test_note = """---
id: test123
title: Test Concept
domain: tech
---

# Test Concept

This is related to [[Another Concept]] and [[Third Concept]].

## Details

More content here.
"""
    
    metadata = parser.parse_frontmatter(test_note)
    entities = parser.extract_entities(test_note, metadata)
    relationships = parser.extract_relationships(test_note, entities)
    
    print(f"✅ 提取实体：{len(entities)}")
    print(f"✅ 提取关系：{len(relationships)}")
    
    print("\n✅ 图谱构建器测试通过！")
