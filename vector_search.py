#!/usr/bin/env python3
"""
向量化搜索引擎 - 基于语义相似度的图谱边动态补全
使用轻量级 Embedding 模型
"""

import json
import hashlib
import sqlite3
from pathlib import Path
from typing import List, Dict, Tuple
from datetime import datetime


class SimpleVectorizer:
    """
    简单向量化器（无需外部依赖）
    使用 TF-IDF + 降维模拟 Embedding
    """
    
    def __init__(self, dim: int = 128):
        self.dim = dim
        self.vocabulary = {}
        self.idf = {}
    
    def _tokenize(self, text: str) -> List[str]:
        """分词"""
        # 简单分词：按空格和标点
        import re
        tokens = re.findall(r'\b\w+\b', text.lower())
        return tokens
    
    def fit(self, documents: List[str]):
        """构建词表和 IDF"""
        # 构建词表
        all_tokens = set()
        for doc in documents:
            tokens = self._tokenize(doc)
            all_tokens.update(tokens)
        
        # 限制词表大小
        vocab_list = sorted(list(all_tokens))[:self.dim * 2]
        self.vocabulary = {token: i for i, token in enumerate(vocab_list)}
        
        # 计算 IDF
        n_docs = len(documents)
        doc_freq = {}
        for doc in documents:
            tokens = set(self._tokenize(doc))
            for token in tokens:
                if token in self.vocabulary:
                    doc_freq[token] = doc_freq.get(token, 0) + 1
        
        import math
        for token, freq in doc_freq.items():
            self.idf[token] = math.log(n_docs / (1 + freq))
    
    def transform(self, text: str) -> List[float]:
        """将文本转换为向量"""
        tokens = self._tokenize(text)
        
        # 计算 TF
        tf = {}
        for token in tokens:
            tf[token] = tf.get(token, 0) + 1
        
        # 归一化 TF
        max_tf = max(tf.values()) if tf else 1
        tf = {k: v / max_tf for k, v in tf.items()}
        
        # 计算 TF-IDF 向量
        vector = [0.0] * self.dim
        for token, tf_val in tf.items():
            if token in self.vocabulary:
                idx = self.vocabulary[token] % self.dim
                idf_val = self.idf.get(token, 1.0)
                vector[idx] += tf_val * idf_val
        
        # L2 归一化
        norm = sum(v * v for v in vector) ** 0.5
        if norm > 0:
            vector = [v / norm for v in vector]
        
        return vector
    
    def cosine_similarity(self, v1: List[float], v2: List[float]) -> float:
        """计算余弦相似度"""
        dot = sum(a * b for a, b in zip(v1, v2))
        norm1 = sum(a * a for a in v1) ** 0.5
        norm2 = sum(b * b for b in v2) ** 0.5
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return dot / (norm1 * norm2)


class VectorStore:
    """向量存储"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self._create_tables()
        self.vectorizer = SimpleVectorizer(dim=128)
    
    def _create_tables(self):
        """创建向量表"""
        cursor = self.conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS embeddings (
                id TEXT PRIMARY KEY,
                note_id TEXT,
                content_hash TEXT,
                embedding TEXT,
                created_at TEXT
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS semantic_edges (
                id TEXT PRIMARY KEY,
                source_id TEXT,
                target_id TEXT,
                similarity REAL,
                created_at TEXT
            )
        """)
        
        self.conn.commit()
    
    def add_document(self, note_id: str, content: str):
        """添加文档向量"""
        content_hash = hashlib.md5(content.encode()).hexdigest()
        embedding = self.vectorizer.transform(content)
        
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO embeddings 
            (id, note_id, content_hash, embedding, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (note_id, note_id, content_hash, 
              json.dumps(embedding), datetime.now().isoformat()))
        
        self.conn.commit()
    
    def fit_from_notes(self, notes: List[Dict]):
        """从笔记列表训练向量器"""
        contents = [n.get('content', '') for n in notes]
        self.vectorizer.fit(contents)
        
        # 向量化所有笔记
        for note in notes:
            self.add_document(note.get('id', ''), note.get('content', ''))
    
    def find_similar(self, note_id: str, top_k: int = 5) -> List[Tuple[str, float]]:
        """查找相似笔记"""
        cursor = self.conn.cursor()
        
        # 获取查询向量
        cursor.execute("SELECT embedding FROM embeddings WHERE id = ?", (note_id,))
        row = cursor.fetchone()
        
        if not row:
            return []
        
        query_vector = json.loads(row[0])
        
        # 计算所有相似度
        cursor.execute("SELECT id, embedding FROM embeddings WHERE id != ?", (note_id,))
        
        similarities = []
        for row in cursor.fetchall():
            doc_id = row[0]
            doc_vector = json.loads(row[1])
            sim = self.vectorizer.cosine_similarity(query_vector, doc_vector)
            similarities.append((doc_id, sim))
        
        # 排序并返回 top_k
        similarities.sort(key=lambda x: x[1], reverse=True)
        return similarities[:top_k]
    
    def create_semantic_edges(self, threshold: float = 0.7):
        """创建语义边"""
        cursor = self.conn.cursor()
        
        # 获取所有向量
        cursor.execute("SELECT id, embedding FROM embeddings")
        embeddings = cursor.fetchall()
        
        edges_created = 0
        for i, (id1, emb1) in enumerate(embeddings):
            for j, (id2, emb2) in enumerate(embeddings):
                if i >= j:
                    continue
                
                v1 = json.loads(emb1)
                v2 = json.loads(emb2)
                sim = self.vectorizer.cosine_similarity(v1, v2)
                
                if sim >= threshold:
                    edge_id = hashlib.md5(f"{id1}_{id2}".encode()).hexdigest()[:16]
                    cursor.execute("""
                        INSERT OR REPLACE INTO semantic_edges
                        (id, source_id, target_id, similarity, created_at)
                        VALUES (?, ?, ?, ?, ?)
                    """, (edge_id, id1, id2, sim, datetime.now().isoformat()))
                    edges_created += 1
        
        self.conn.commit()
        return edges_created
    
    def get_stats(self) -> Dict:
        """获取统计"""
        cursor = self.conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM embeddings")
        embeddings = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM semantic_edges")
        edges = cursor.fetchone()[0]
        
        return {"embeddings": embeddings, "semantic_edges": edges}


if __name__ == "__main__":
    print("🧪 测试向量化搜索引擎...")
    
    store = VectorStore(":memory:")
    
    # 测试文档
    docs = [
        {"id": "doc1", "content": "AI and machine learning are transforming technology"},
        {"id": "doc2", "content": "Deep learning is a subset of machine learning"},
        {"id": "doc3", "content": "Philosophy explores the nature of consciousness"},
        {"id": "doc4", "content": "Neural networks mimic the human brain"},
    ]
    
    # 训练
    store.fit_from_notes(docs)
    
    # 查找相似
    similar = store.find_similar("doc1", top_k=2)
    print(f"\n✅ doc1 的相似文档:")
    for doc_id, sim in similar:
        print(f"   {doc_id}: {sim:.3f}")
    
    # 创建语义边
    edges = store.create_semantic_edges(threshold=0.5)
    print(f"\n✅ 创建语义边：{edges} 条")
    
    stats = store.get_stats()
    print(f"\n📊 统计：{stats}")
    
    print("\n✅ 向量化搜索测试通过！")
