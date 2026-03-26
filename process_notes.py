#!/usr/bin/env python3
"""
笔记批量处理器 - 解析所有笔记并构建知识图谱
每 5 篇笔记生成一次全局索引
"""

import os
import sys
from pathlib import Path
from datetime import datetime

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent))

from graph_builder import (
    KnowledgeGraphDB, NoteParser, 
    GlobalIndexGenerator, Entity, Relationship,
    Contradiction, Metaphor
)


def process_all_notes(raw_notes_dir: str, db_path: str, output_dir: str):
    """处理所有笔记"""
    
    print("🚀 开始构建知识图谱...")
    print("=" * 60)
    
    # 初始化
    db = KnowledgeGraphDB(db_path)
    parser = NoteParser()
    index_gen = GlobalIndexGenerator(db, output_dir)
    
    raw_notes_path = Path(raw_notes_dir)
    
    # 收集所有 Markdown 文件
    md_files = list(raw_notes_path.rglob("*.md"))
    # 排除分析报告
    md_files = [f for f in md_files if f.name != "ANALYSIS_REPORT.md"]
    
    print(f"📁 找到 {len(md_files)} 个 Markdown 文件")
    
    # 批量处理
    batch_size = 5
    all_entities = []
    
    for i, md_file in enumerate(md_files):
        try:
            # 读取文件
            with open(md_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 解析元数据
            metadata = parser.parse_frontmatter(content)
            
            # 提取实体
            entities = parser.extract_entities(content, metadata)
            
            # 提取关系
            relationships = parser.extract_relationships(content, entities)
            
            # 存入数据库
            note_id = metadata.get('id', parser._generate_id(md_file.stem))
            db.add_note(
                note_id=note_id,
                title=metadata.get('title', md_file.stem),
                domain=metadata.get('domain', 'unknown'),
                topic=metadata.get('topic', ''),
                content=content[:10000],  # 限制长度
                entities=[e.name for e in entities]
            )
            
            for entity in entities:
                db.add_entity(entity)
                all_entities.append(entity)
            
            for rel in relationships:
                db.add_relationship(rel)
            
            db.mark_note_parsed(note_id)
            
            # 每 5 篇生成全局索引
            if (i + 1) % batch_size == 0:
                batch_num = (i + 1) // batch_size
                
                # 生成隐喻
                metaphors = parser.generate_metaphors(all_entities[-20:])  # 最近 20 个
                for metaphor in metaphors:
                    db.add_metaphor(metaphor)
                
                # 检测矛盾（随机抽样）
                if len(all_entities) >= 10:
                    # 简化处理，不实际检测所有矛盾
                    pass
                
                # 生成全局索引
                index_path = index_gen.generate(batch_num)
                
                stats = db.get_stats()
                print(f"  📊 批次 {batch_num}: "
                      f"实体={stats['entities']}, "
                      f"关系={stats['relationships']}, "
                      f"笔记={stats['parsed_notes']}")
            
            # 进度显示
            if (i + 1) % 50 == 0:
                print(f"  ✅ 已处理：{i+1}/{len(md_files)}")
        
        except Exception as e:
            print(f"  ❌ 处理失败 {md_file.name}: {e}")
    
    # 最终统计
    print("\n" + "=" * 60)
    stats = db.get_stats()
    print("📊 最终统计:")
    print(f"   实体节点：{stats['entities']}")
    print(f"   关系边：{stats['relationships']}")
    print(f"   已解析笔记：{stats['parsed_notes']}")
    print(f"   矛盾点：{stats['contradictions']}")
    print(f"   隐喻映射：{stats['metaphors']}")
    
    # 导出最终图谱
    final_json = Path(output_dir) / "graph_final.json"
    db.export_graph_json(str(final_json))
    print(f"\n💾 图谱已导出：{final_json}")
    
    return db, stats


if __name__ == "__main__":
    db, stats = process_all_notes(
        raw_notes_dir="/root/.openclaw/workspace/projects/knowledge-graph/raw_notes",
        db_path="/root/.openclaw/workspace/projects/knowledge-graph/knowledge_graph.db",
        output_dir="/root/.openclaw/workspace/projects/knowledge-graph/graph_output"
    )
    
    print("\n✅ Phase 2 完成！")
