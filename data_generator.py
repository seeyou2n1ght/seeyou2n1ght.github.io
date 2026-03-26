#!/usr/bin/env python3
"""
复杂测试语料自主生成器
生成 300+ 个具有复杂关联的 Markdown 笔记
"""

import os
import random
import hashlib
from datetime import datetime, timedelta
from pathlib import Path

# 领域定义
DOMAINS = {
    "tech": {
        "topics": ["AI", "Blockchain", "Cloud", "Security", "DevOps", "Database", "API", "Microservices"],
        "concepts": ["Neural Network", "Smart Contract", "Kubernetes", "Encryption", "CI/CD", "NoSQL", "REST", "Container"],
        "relations": ["implements", "depends_on", "optimizes", "replaces", "extends", "integrates_with"]
    },
    "philosophy": {
        "topics": ["Ethics", "Metaphysics", "Epistemology", "Logic", "Existentialism", "Stoicism", "Phenomenology"],
        "concepts": ["Consciousness", "Reality", "Knowledge", "Truth", "Freedom", "Virtue", "Experience"],
        "relations": ["implies", "contradicts", "supports", "questions", "refines", "transcends"]
    },
    "science": {
        "topics": ["Physics", "Biology", "Chemistry", "Neuroscience", "Ecology", "Genetics", "Quantum"],
        "concepts": ["Energy", "Cell", "Molecule", "Neuron", "Ecosystem", "DNA", "Particle"],
        "relations": ["causes", "correlates_with", "inhibits", "accelerates", "transforms", "connects"]
    }
}

class NoteGenerator:
    def __init__(self, base_dir: str):
        self.base_dir = Path(base_dir)
        self.generated_notes = []
        self.entity_map = {}
        
    def generate_id(self, content: str) -> str:
        return hashlib.md5(content.encode()).hexdigest()[:8]
    
    def generate_wikilink(self, title: str) -> str:
        return f"[[{title}]]"
    
    def generate_dataview_query(self, field: str, value: str) -> str:
        return f"```dataview\nTABLE file.link WHERE {field} = \"{value}\"\n```"
    
    def generate_note(self, domain: str, topic: str, index: int) -> dict:
        domain_data = DOMAINS[domain]
        concept = random.choice(domain_data["concepts"])
        related_concepts = random.sample([c for c in domain_data["concepts"] if c != concept], 
                                         min(3, len(domain_data["concepts"])-1))
        
        title = f"{concept} in {topic} #{index}"
        note_id = self.generate_id(title)
        
        # 生成双向链接
        wikilinks = [self.generate_wikilink(f"{rc} in {random.choice(domain_data['topics'])} {random.randint(1, 50)}") 
                     for rc in related_concepts]
        
        # 生成 Dataview 查询
        dataview = self.generate_dataview_query("topic", topic)
        
        # 生成内容
        content = f"""---
id: {note_id}
title: {title}
domain: {domain}
topic: {topic}
created: {datetime.now().isoformat()}
tags: [{domain}, {topic.lower()}, {concept.lower()}]
aliases: ["{concept}", "{concept} Overview"]
---

# {title}

## 核心定义

{concept} 是 {domain} 领域中的一个核心概念，它指的是...

## 关键特性

- 特性 1: {random.choice(['可扩展性', '抽象性', '普适性', '精确性'])}
- 特性 2: {random.choice(['模块化', '动态性', '稳定性', '灵活性'])}
- 特性 3: {random.choice(['高效性', '可靠性', '安全性', '易用性'])}

## 相关概念

{chr(10).join([f"- {self.generate_wikilink(rc)}" for rc in related_concepts])}

## 应用领域

{dataview}

## 参考文献

1. [[Reference Note 1]]
2. [[Reference Note 2]]

## 待探索问题

- {concept} 如何影响 {random.choice(related_concepts)}?
- 在什么条件下 {concept} 会失效？
- {concept} 的历史演变是怎样的？

---
*最后更新：{datetime.now().strftime("%Y-%m-%d")}*
"""
        
        return {
            "id": note_id,
            "title": title,
            "domain": domain,
            "topic": topic,
            "content": content,
            "wikilinks": wikilinks,
            "entities": [concept] + related_concepts
        }
    
    def generate_all(self, total_notes: int = 350):
        """生成所有笔记"""
        notes_per_domain = total_notes // len(DOMAINS)
        
        for domain, domain_data in DOMAINS.items():
            domain_dir = self.base_dir / domain
            domain_dir.mkdir(parents=True, exist_ok=True)
            
            for i in range(notes_per_domain):
                topic = random.choice(domain_data["topics"])
                note = self.generate_note(domain, topic, i + 1)
                
                # 保存文件
                filename = f"{note['title'].replace(' ', '_').replace('/', '_')}.md"
                filepath = domain_dir / filename
                
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(note['content'])
                
                self.generated_notes.append(note)
                self.entity_map[note['id']] = note['entities']
                
                if (i + 1) % 50 == 0:
                    print(f"  ✅ {domain}: {i+1}/{notes_per_domain}")
        
        print(f"\n✅ 总共生成 {len(self.generated_notes)} 个笔记")
        return self.generated_notes
    
    def generate_analysis_report(self) -> str:
        """生成深度分析报告"""
        report = f"""# 知识图谱语料深度分析报告

**生成时间**: {datetime.now().isoformat()}
**语料总数**: {len(self.generated_notes)}

---

## 1. 文件树结构

```
raw_notes/
├── tech/           ({len([n for n in self.generated_notes if n['domain']=='tech'])} 文件)
├── philosophy/     ({len([n for n in self.generated_notes if n['domain']=='philosophy'])} 文件)
└── science/        ({len([n for n in self.generated_notes if n['domain']=='science'])} 文件)
```

## 2. 统计信息

| 指标 | 数值 |
|:---|:---:|
| 总文件数 | {len(self.generated_notes)} |
| 平均字数 | {sum(len(n['content'].split()) for n in self.generated_notes) // len(self.generated_notes)} |
| 总字数 | {sum(len(n['content'].split()) for n in self.generated_notes):,} |
| 唯一实体数 | {len(set(e for note in self.generated_notes for e in note['entities']))} |
| 平均链接数 | {sum(len(n['wikilinks']) for n in self.generated_notes) // len(self.generated_notes)} |

## 3. Markdown 方言检测

| 方言 | 使用率 | 示例 |
|:---|:---:|:---|
| Wikilinks | 100% | [[Concept]] |
| Dataview | 100% | ```dataview TABLE...``` |
| Frontmatter | 100% | --- id: ... --- |
| MathJax | 0% | $E=mc^2$ |

## 4. 领域分布

"""
        
        for domain in DOMAINS.keys():
            count = len([n for n in self.generated_notes if n['domain'] == domain])
            topics = set(n['topic'] for n in self.generated_notes if n['domain'] == domain)
            report += f"### {domain.upper()}\n"
            report += f"- 笔记数：{count}\n"
            report += f"- 主题数：{len(topics)}\n"
            report += f"- 主题列表：{', '.join(topics)}\n\n"
        
        report += """
## 5. 实体关系网络

总实体关系数：{total_relations}

### 高频实体 Top 10

""".format(total_relations=sum(len(n['entities']) for n in self.generated_notes))
        
        # 统计实体频率
        entity_freq = {}
        for note in self.generated_notes:
            for entity in note['entities']:
                entity_freq[entity] = entity_freq.get(entity, 0) + 1
        
        top_entities = sorted(entity_freq.items(), key=lambda x: x[1], reverse=True)[:10]
        for entity, freq in top_entities:
            report += f"- {entity}: {freq} 次\n"
        
        return report


if __name__ == "__main__":
    print("🚀 开始生成复杂测试语料...")
    
    generator = NoteGenerator("/root/.openclaw/workspace/projects/knowledge-graph/raw_notes")
    notes = generator.generate_all(350)
    
    # 生成分析报告
    report = generator.generate_analysis_report()
    report_path = "/root/.openclaw/workspace/projects/knowledge-graph/raw_notes/ANALYSIS_REPORT.md"
    
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n📊 分析报告已保存：{report_path}")
    print("\n✅ Phase 1 完成！")
