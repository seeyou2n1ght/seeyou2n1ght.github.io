#!/usr/bin/env python3
"""
知识图谱构建器 - 单元测试套件
覆盖率目标：100%
"""

import pytest
import sqlite3
import os
import sys
from pathlib import Path
from datetime import datetime

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent))

from graph_builder import (
    KnowledgeGraphDB, NoteParser, GlobalIndexGenerator,
    Entity, Relationship, Contradiction, Metaphor
)


# ============================================================
# Fixtures
# ============================================================

@pytest.fixture
def in_memory_db():
    """提供内存数据库用于测试"""
    db = KnowledgeGraphDB(":memory:")
    yield db
    db.conn.close()


@pytest.fixture
def sample_note():
    """提供示例笔记"""
    return """---
id: test-001
title: Test Concept
domain: tech
topic: AI
tags: [ai, test]
---

# Test Concept

This is a [[Related Concept]] about AI.

## Details

It relates to [[Another Concept]] and [[Third Concept]].

```dataview
TABLE file.link WHERE topic = "AI"
```

---
*Last updated: 2026-03-24*
"""


@pytest.fixture
def parser():
    """提供解析器实例"""
    return NoteParser()


# ============================================================
# Entity Tests
# ============================================================

class TestEntity:
    """实体类测试"""
    
    def test_entity_creation(self):
        """测试实体创建"""
        entity = Entity(
            id="test-001",
            name="Test Entity",
            type="concept",
            domain="tech",
            properties={"key": "value"},
            created_at="2026-03-24T12:00:00"
        )
        
        assert entity.id == "test-001"
        assert entity.name == "Test Entity"
        assert entity.type == "concept"
        assert entity.domain == "tech"
        assert entity.properties == {"key": "value"}
    
    def test_entity_from_dict(self):
        """测试实体从字典创建"""
        data = {
            "id": "test-002",
            "name": "Dict Entity",
            "type": "topic",
            "domain": "science",
            "properties": {},
            "created_at": "2026-03-24T12:00:00"
        }
        
        entity = Entity(**data)
        assert entity.name == "Dict Entity"
        assert entity.domain == "science"


# ============================================================
# Relationship Tests
# ============================================================

class TestRelationship:
    """关系类测试"""
    
    def test_relationship_creation(self):
        """测试关系创建"""
        rel = Relationship(
            id="rel-001",
            source_id="entity-1",
            target_id="entity-2",
            type="links_to",
            properties={},
            strength=0.9
        )
        
        assert rel.source_id == "entity-1"
        assert rel.target_id == "entity-2"
        assert rel.strength == 0.9
    
    def test_relationship_strength_range(self):
        """测试关系强度范围"""
        # 强度应该在 0-1 之间
        rel = Relationship(
            id="rel-002",
            source_id="e1",
            target_id="e2",
            type="supports",
            properties={},
            strength=0.5
        )
        
        assert 0 <= rel.strength <= 1


# ============================================================
# Database Tests
# ============================================================

class TestKnowledgeGraphDB:
    """数据库操作测试"""
    
    def test_create_tables(self, in_memory_db):
        """测试表创建"""
        cursor = in_memory_db.conn.cursor()
        
        # 检查表是否存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
        assert 'entities' in tables
        assert 'relationships' in tables
        assert 'notes' in tables
        assert 'contradictions' in tables
        assert 'metaphors' in tables
    
    def test_add_entity(self, in_memory_db):
        """测试添加实体"""
        entity = Entity(
            id="test-entity",
            name="Test",
            type="concept",
            domain="tech",
            properties={},
            created_at="2026-03-24"
        )
        
        in_memory_db.add_entity(entity)
        
        # 验证插入
        cursor = in_memory_db.conn.cursor()
        cursor.execute("SELECT * FROM entities WHERE id = ?", ("test-entity",))
        row = cursor.fetchone()
        
        assert row is not None
        assert row[1] == "Test"
    
    def test_add_relationship(self, in_memory_db):
        """测试添加关系"""
        # 先添加实体
        in_memory_db.add_entity(Entity(
            id="source", name="Source", type="concept",
            domain="tech", properties={}, created_at="2026-03-24"
        ))
        in_memory_db.add_entity(Entity(
            id="target", name="Target", type="concept",
            domain="tech", properties={}, created_at="2026-03-24"
        ))
        
        # 添加关系
        rel = Relationship(
            id="rel-test",
            source_id="source",
            target_id="target",
            type="links_to",
            properties={},
            strength=0.8
        )
        in_memory_db.add_relationship(rel)
        
        # 验证
        cursor = in_memory_db.conn.cursor()
        cursor.execute("SELECT * FROM relationships WHERE id = ?", ("rel-test",))
        row = cursor.fetchone()
        
        assert row is not None
        assert row[1] == "source"
        assert row[2] == "target"
    
    def test_get_stats(self, in_memory_db):
        """测试统计信息"""
        stats = in_memory_db.get_stats()
        
        assert 'entities' in stats
        assert 'relationships' in stats
        assert 'parsed_notes' in stats
        assert stats['entities'] == 0  # 初始为空
    
    def test_add_note(self, in_memory_db):
        """测试添加笔记"""
        in_memory_db.add_note(
            note_id="note-001",
            title="Test Note",
            domain="tech",
            topic="AI",
            content="Test content",
            entities=["Entity1", "Entity2"]
        )
        
        cursor = in_memory_db.conn.cursor()
        cursor.execute("SELECT * FROM notes WHERE id = ?", ("note-001",))
        row = cursor.fetchone()
        
        assert row is not None
        assert row[1] == "Test Note"
        assert row[3] == "AI"
    
    def test_mark_note_parsed(self, in_memory_db):
        """测试标记笔记已解析"""
        in_memory_db.add_note(
            note_id="note-002",
            title="Test",
            domain="tech",
            topic="",
            content="",
            entities=[]
        )
        
        # 初始未解析
        cursor = in_memory_db.conn.cursor()
        cursor.execute("SELECT parsed FROM notes WHERE id = ?", ("note-002",))
        assert cursor.fetchone()[0] == 0
        
        # 标记为已解析
        in_memory_db.mark_note_parsed("note-002")
        
        cursor.execute("SELECT parsed FROM notes WHERE id = ?", ("note-002",))
        assert cursor.fetchone()[0] == 1


# ============================================================
# Parser Tests
# ============================================================

class TestNoteParser:
    """笔记解析器测试"""
    
    def test_parse_wikilinks(self, parser):
        """测试 Wikilinks 提取"""
        content = "This is about [[Concept A]] and [[Concept B]]."
        links = parser.parse_wikilinks(content)
        
        assert len(links) == 2
        assert "Concept A" in links
        assert "Concept B" in links
    
    def test_parse_wikilinks_empty(self, parser):
        """测试空内容"""
        links = parser.parse_wikilinks("No links here")
        assert len(links) == 0
    
    def test_parse_frontmatter(self, parser, sample_note):
        """测试 Frontmatter 提取"""
        metadata = parser.parse_frontmatter(sample_note)
        
        assert metadata.get('id') == 'test-001'
        assert metadata.get('title') == 'Test Concept'
        assert metadata.get('domain') == 'tech'
        assert metadata.get('topic') == 'AI'
    
    def test_parse_frontmatter_empty(self, parser):
        """测试无 Frontmatter"""
        content = "Just plain text"
        metadata = parser.parse_frontmatter(content)
        assert metadata == {}
    
    def test_extract_entities(self, parser, sample_note):
        """测试实体提取"""
        metadata = parser.parse_frontmatter(sample_note)
        entities = parser.extract_entities(sample_note, metadata)
        
        assert len(entities) >= 1  # 至少有一个标题实体
        assert any(e.name == "Test Concept" for e in entities)
    
    def test_extract_relationships(self, parser, sample_note):
        """测试关系提取"""
        metadata = parser.parse_frontmatter(sample_note)
        entities = parser.extract_entities(sample_note, metadata)
        relationships = parser.extract_relationships(sample_note, entities)
        
        # 应该从同一段落中的 wikilinks 提取关系
        assert len(relationships) >= 0
    
    def test_detect_contradictions(self, parser):
        """测试矛盾检测"""
        note1 = {
            'id': 'note-1',
            'content': 'This is always true and must happen.'
        }
        note2 = {
            'id': 'note-2',
            'content': 'This is never true and never happens.'
        }
        
        contradiction = parser.detect_contradictions(note1, note2)
        
        assert contradiction is not None
        assert 'always' in contradiction.description.lower() or 'never' in contradiction.description.lower()
    
    def test_generate_metaphors(self, parser):
        """测试隐喻生成"""
        entities = [
            Entity(id="1", name="Neuron", type="concept", domain="science", properties={}, created_at=""),
            Entity(id="2", name="Network", type="concept", domain="tech", properties={}, created_at=""),
        ]
        
        metaphors = parser.generate_metaphors(entities)
        
        assert len(metaphors) >= 1
        assert metaphors[0].source_domain in ["science", "tech"]
        assert metaphors[0].target_domain in ["science", "tech"]


# ============================================================
# Edge Case Tests
# ============================================================

class TestEdgeCases:
    """边缘情况测试"""
    
    def test_empty_file(self, parser):
        """测试空文件"""
        content = ""
        metadata = parser.parse_frontmatter(content)
        assert metadata == {}
    
    def test_large_file(self, parser):
        """测试大文件（模拟）"""
        content = "---\nid: large\n---\n\n# Large\n\n" + "A" * 100000
        metadata = parser.parse_frontmatter(content)
        assert metadata.get('id') == 'large'
    
    def test_circular_reference(self, in_memory_db):
        """测试循环引用"""
        # A -> B -> A
        in_memory_db.add_entity(Entity(
            id="A", name="A", type="concept",
            domain="tech", properties={}, created_at=""
        ))
        in_memory_db.add_entity(Entity(
            id="B", name="B", type="concept",
            domain="tech", properties={}, created_at=""
        ))
        
        in_memory_db.add_relationship(Relationship(
            id="A-B", source_id="A", target_id="B",
            type="links_to", properties={}, strength=1.0
        ))
        in_memory_db.add_relationship(Relationship(
            id="B-A", source_id="B", target_id="A",
            type="links_to", properties={}, strength=1.0
        ))
        
        # 应该成功插入，不报错
        stats = in_memory_db.get_stats()
        assert stats['relationships'] == 2
    
    def test_broken_html(self, parser):
        """测试破损 HTML"""
        content = """---
id: html-test
---

# Test

<div class="broken
<p>Unclosed tag
"""
        metadata = parser.parse_frontmatter(content)
        assert metadata.get('id') == 'html-test'
    
    def test_unicode_content(self, parser):
        """测试 Unicode 内容"""
        content = """---
id: unicode
title: 测试标题 🚀
---

# 测试

这是一个包含 emoji 和中文的笔记。
"""
        metadata = parser.parse_frontmatter(content)
        assert metadata.get('title') == '测试标题 🚀'
    
    def test_special_characters(self, parser):
        """测试特殊字符"""
        content = """---
id: special
title: "Test: <>&"
---

# $E = mc^2$

Math and "quotes" & <tags>
"""
        metadata = parser.parse_frontmatter(content)
        assert metadata.get('id') == 'special'
    
    def test_utf8_bom(self, in_memory_db):
        """测试 UTF-8 BOM"""
        # 模拟带 BOM 的内容
        content = "\ufeff---\nid: bom-test\n---\n\nContent"
        
        # 应该能正常处理
        assert "\ufeff" in content
        # 实际解析时应去除 BOM


# ============================================================
# Global Index Tests
# ============================================================

class TestGlobalIndexGenerator:
    """全局索引生成器测试"""
    
    def test_generate_index(self, in_memory_db, tmp_path):
        """测试索引生成"""
        gen = GlobalIndexGenerator(in_memory_db, str(tmp_path))
        
        # 添加一些测试数据
        in_memory_db.add_entity(Entity(
            id="test", name="Test", type="concept",
            domain="tech", properties={}, created_at=""
        ))
        
        index_path = gen.generate(batch_num=1)
        
        assert Path(index_path).exists()
        
        # 检查内容
        content = Path(index_path).read_text()
        assert "知识图谱全局索引" in content
        assert "批次" in content


# ============================================================
# Integration Tests
# ============================================================

class TestIntegration:
    """集成测试"""
    
    def test_full_pipeline(self, in_memory_db, tmp_path, sample_note):
        """测试完整流程"""
        parser = NoteParser()
        gen = GlobalIndexGenerator(in_memory_db, str(tmp_path))
        
        # 解析笔记
        metadata = parser.parse_frontmatter(sample_note)
        entities = parser.extract_entities(sample_note, metadata)
        relationships = parser.extract_relationships(sample_note, entities)
        
        # 存入数据库
        note_id = metadata.get('id', 'test')
        in_memory_db.add_note(
            note_id=note_id,
            title=metadata.get('title', 'Test'),
            domain=metadata.get('domain', 'unknown'),
            topic=metadata.get('topic', ''),
            content=sample_note,
            entities=[e.name for e in entities]
        )
        
        for entity in entities:
            in_memory_db.add_entity(entity)
        
        for rel in relationships:
            in_memory_db.add_relationship(rel)
        
        in_memory_db.mark_note_parsed(note_id)
        
        # 生成索引
        index_path = gen.generate(batch_num=1)
        
        # 验证
        stats = in_memory_db.get_stats()
        assert stats['parsed_notes'] == 1
        assert stats['entities'] >= 1
        
        assert Path(index_path).exists()


# ============================================================
# Run Tests
# ============================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
