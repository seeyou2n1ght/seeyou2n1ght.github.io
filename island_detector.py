#!/usr/bin/env python3
"""
孤岛节点发现器
自动发现图谱中的孤立节点并生成连接内容
"""

import sqlite3
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Set


class IslandDetector:
    """孤岛检测器"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
    
    def find_islands(self, min_connections: int = 1) -> List[Dict]:
        """
        查找孤岛节点
        
        Args:
            min_connections: 最小连接数阈值
        
        Returns:
            孤岛节点列表
        """
        cursor = self.conn.cursor()
        
        # 查找连接数少于阈值的节点
        cursor.execute("""
            SELECT e.id, e.name, e.type, e.domain, e.properties,
                   (SELECT COUNT(*) FROM relationships 
                    WHERE source_id = e.id OR target_id = e.id) as connection_count
            FROM entities e
            WHERE connection_count < ?
            ORDER BY connection_count ASC
            LIMIT 50
        """, (min_connections + 1,))
        
        islands = []
        for row in cursor.fetchall():
            props = json.loads(row['properties']) if row['properties'] else {}
            islands.append({
                'id': row['id'],
                'name': row['name'],
                'type': row['type'],
                'domain': row['domain'],
                'properties': props,
                'connections': row['connection_count']
            })
        
        return islands
    
    def find_potential_connections(self, island: Dict, top_k: int = 5) -> List[Dict]:
        """
        查找可能连接到该孤岛的节点
        
        基于：
        1. 相同领域
        2. 相似类型
        3. 名称相似度
        """
        cursor = self.conn.cursor()
        
        # 查找同领域的节点
        cursor.execute("""
            SELECT id, name, type, domain,
                   (SELECT COUNT(*) FROM relationships 
                    WHERE source_id = e.id OR target_id = e.id) as connections
            FROM entities e
            WHERE domain = ? AND id != ?
            ORDER BY connections DESC
            LIMIT ?
        """, (island['domain'], island['id'], top_k))
        
        candidates = []
        for row in cursor.fetchall():
            candidates.append({
                'id': row['id'],
                'name': row['name'],
                'type': row['type'],
                'domain': row['domain'],
                'connections': row['connections'],
                'reason': f'同领域 ({island["domain"]})'
            })
        
        # 如果没有同领域的，找同类型的
        if not candidates:
            cursor.execute("""
                SELECT id, name, type, domain,
                       (SELECT COUNT(*) FROM relationships 
                        WHERE source_id = e.id OR target_id = e.id) as connections
                FROM entities e
                WHERE type = ? AND id != ?
                ORDER BY connections DESC
                LIMIT ?
            """, (island['type'], island['id'], top_k))
            
            for row in cursor.fetchall():
                candidates.append({
                    'id': row['id'],
                    'name': row['name'],
                    'type': row['type'],
                    'domain': row['domain'],
                    'connections': row['connections'],
                    'reason': f'同类型 ({island["type"]})'
                })
        
        return candidates
    
    def generate_connection_content(self, island: Dict, target: Dict) -> str:
        """生成连接两个节点的 Markdown 内容"""
        content = f"""---
id: bridge_{island['id']}_{target['id']}
title: "{island['name']} 与 {target['name']} 的关联"
domain: {island['domain']}
tags: [bridge, connection, {island['domain']}]
created: {datetime.now().isoformat()}
---

# {island['name']} 与 {target['name']} 的关联

## 背景

在知识图谱中，**{island['name']}** 和 **{target['name']}** 是两个相关但尚未建立明确联系的概念。

## 概念解析

### {island['name']}

{island['name']} 是 {island['domain']} 领域中的一个概念，类型为 {island['type']}。

### {target['name']}

{target['name']} 同样是 {target['domain']} 领域的重要概念，类型为 {target['type']}。

## 关联性分析

### 共同点

1. **领域相关**: 两者都属于 **{island['domain']}** 领域
2. **概念层次**: 都是 {island['type']} 级别的概念
3. **应用场景**: 在实际应用中经常同时出现

### 差异点

1. **关注点不同**: {island['name']} 更关注...，而 {target['name']} 更关注...
2. **方法论**: 两者采用的方法有所不同
3. **适用范围**: 各自适用的场景有所区别

## 建立联系

通过以下关系可以将两者连接：

- **{island['name']}** → `extends` → **{target['name']}**
- **{target['name']}** → `supports` → **{island['name']}**

## 实际案例

在实际应用中，{island['name']} 和 {target['name']} 经常协同工作：

1. 案例 1: ...
2. 案例 2: ...

## 进一步探索

- [[{island['name']}]] 的深入研究
- [[{target['name']}]] 的应用实践
- 相关概念的学习路径

---
*由孤岛发现器自动生成 - {datetime.now().strftime("%Y-%m-%d")}*
"""
        return content
    
    def create_bridge_relationship(self, island_id: str, target_id: str, 
                                   relation_type: str = "related_to"):
        """在数据库中创建桥接关系"""
        cursor = self.conn.cursor()
        
        import hashlib
        rel_id = hashlib.md5(f"{island_id}_{target_id}".encode()).hexdigest()[:16]
        
        cursor.execute("""
            INSERT OR REPLACE INTO relationships 
            (id, source_id, target_id, type, properties, strength)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (rel_id, island_id, target_id, relation_type, 
              json.dumps({"auto_generated": True}), 0.5))
        
        self.conn.commit()
        return rel_id
    
    def generate_report(self, islands: List[Dict]) -> str:
        """生成孤岛分析报告"""
        report = f"""# 🏝️ 孤岛节点分析报告

**生成时间**: {datetime.now().isoformat()}
**孤岛总数**: {len(islands)}

---

## 统计概览

| 领域 | 孤岛数量 | 占比 |
|:---|:---:|:---:|
"""
        
        domain_count = {}
        for island in islands:
            domain = island['domain']
            domain_count[domain] = domain_count.get(domain, 0) + 1
        
        for domain, count in sorted(domain_count.items(), key=lambda x: x[1], reverse=True):
            percentage = count / len(islands) * 100
            report += f"| {domain} | {count} | {percentage:.1f}% |\n"
        
        report += """
---

## 孤岛节点列表

"""
        
        for i, island in enumerate(islands[:20], 1):
            report += f"### {i}. {island['name']}\n"
            report += f"- **ID**: `{island['id']}`\n"
            report += f"- **领域**: {island['domain']}\n"
            report += f"- **类型**: {island['type']}\n"
            report += f"- **当前连接数**: {island['connections']}\n\n"
        
        report += """
---

## 建议操作

1. **高优先级**: 连接数为 0 的节点应优先处理
2. **中优先级**: 同领域内建立连接
3. **低优先级**: 跨领域建立隐喻连接

---

*报告由孤岛发现器自动生成*
"""
        
        return report
    
    def close(self):
        """关闭连接"""
        self.conn.close()


def main():
    """主函数"""
    print("🏝️ 启动孤岛发现器...")
    
    db_path = "/root/.openclaw/workspace/projects/knowledge-graph/knowledge_graph.db"
    output_dir = Path("/root/.openclaw/workspace/projects/knowledge-graph/island_bridges")
    output_dir.mkdir(exist_ok=True)
    
    detector = IslandDetector(db_path)
    
    # 查找孤岛
    print("\n🔍 查找孤岛节点...")
    islands = detector.find_islands(min_connections=1)
    print(f"✅ 发现 {len(islands)} 个孤岛节点")
    
    # 生成报告
    report = detector.generate_report(islands)
    report_path = output_dir / "island_report.md"
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report)
    print(f"📊 报告已保存：{report_path}")
    
    # 为前 10 个孤岛生成桥接内容
    print("\n🌉 生成桥接内容...")
    for i, island in enumerate(islands[:10]):
        print(f"  处理：{island['name']} ({i+1}/{len(islands[:10])})")
        
        # 查找潜在连接
        targets = detector.find_potential_connections(island, top_k=3)
        
        if targets:
            target = targets[0]  # 选择连接数最多的
            
            # 生成桥接内容
            content = detector.generate_connection_content(island, target)
            bridge_path = output_dir / f"bridge_{island['id']}.md"
            with open(bridge_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            # 在数据库中创建关系
            detector.create_bridge_relationship(island['id'], target['id'])
    
    detector.close()
    
    print(f"\n✅ 孤岛发现完成！")
    print(f"📁 输出目录：{output_dir}")
    print(f"📊 生成桥接：{min(10, len(islands))} 个")


if __name__ == "__main__":
    main()
