#!/usr/bin/env python3
"""
知识图谱 Web 服务器
提供图谱数据 API 和前端页面
"""

import json
import sqlite3
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs


class GraphAPIHandler(SimpleHTTPRequestHandler):
    """自定义 HTTP 处理器"""
    
    def __init__(self, *args, db_path: str = None, **kwargs):
        self.db_path = db_path or "/root/.openclaw/workspace/projects/knowledge-graph/knowledge_graph.db"
        super().__init__(*args, **kwargs)
    
    def do_GET(self):
        """处理 GET 请求"""
        parsed = urlparse(self.path)
        
        # API 端点
        if parsed.path == '/api/graph':
            self.send_graph_data()
        elif parsed.path == '/api/stats':
            self.send_stats()
        elif parsed.path == '/api/search':
            query = parse_qs(parsed.query).get('q', [''])[0]
            self.send_search_results(query)
        else:
            # 静态文件
            super().do_GET()
    
    def send_graph_data(self):
        """发送图谱数据"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # 获取节点
            cursor.execute("SELECT id, name, type, domain, properties FROM entities LIMIT 500")
            nodes = []
            for row in cursor.fetchall():
                props = json.loads(row['properties']) if row['properties'] else {}
                nodes.append({
                    'id': row['id'],
                    'label': row['name'],
                    'type': row['type'],
                    'domain': row['domain'],
                    'properties': props
                })
            
            # 获取边
            cursor.execute("""
                SELECT r.id, r.source_id, r.target_id, r.type, r.strength,
                       (SELECT COUNT(*) FROM relationships WHERE source_id = r.source_id OR target_id = r.source_id) as connections
                FROM relationships r
                LIMIT 500
            """)
            edges = []
            for row in cursor.fetchall():
                edges.append({
                    'id': row['id'],
                    'source': row['source_id'],
                    'target': row['target_id'],
                    'type': row['type'],
                    'strength': row['strength']
                })
            
            # 获取语义边数量
            cursor.execute("SELECT COUNT(*) FROM semantic_edges")
            semantic_count = cursor.fetchone()[0]
            
            conn.close()
            
            # 添加连接数到节点
            connection_count = {}
            for edge in edges:
                connection_count[edge['source']] = connection_count.get(edge['source'], 0) + 1
                connection_count[edge['target']] = connection_count.get(edge['target'], 0) + 1
            
            for node in nodes:
                node['connections'] = connection_count.get(node['id'], 0)
            
            data = {
                'nodes': nodes,
                'edges': edges,
                'semantic_edges': semantic_count
            }
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode())
            
        except Exception as e:
            self.send_error(500, str(e))
    
    def send_stats(self):
        """发送统计信息"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            stats = {}
            
            cursor.execute("SELECT COUNT(*) FROM entities")
            stats['entities'] = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM relationships")
            stats['relationships'] = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM notes WHERE parsed = 1")
            stats['parsed_notes'] = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM semantic_edges")
            stats['semantic_edges'] = cursor.fetchone()[0]
            
            cursor.execute("SELECT domain, COUNT(*) FROM entities GROUP BY domain")
            stats['by_domain'] = dict(cursor.fetchall())
            
            conn.close()
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(stats, ensure_ascii=False).encode())
            
        except Exception as e:
            self.send_error(500, str(e))
    
    def send_search_results(self, query: str):
        """发送搜索结果"""
        if not query:
            self.send_response(400)
            self.end_headers()
            return
        
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, name, type, domain
                FROM entities
                WHERE name LIKE ?
                LIMIT 20
            """, (f'%{query}%',))
            
            results = []
            for row in cursor.fetchall():
                results.append({
                    'id': row['id'],
                    'label': row['name'],
                    'type': row['type'],
                    'domain': row['domain']
                })
            
            conn.close()
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(results, ensure_ascii=False).encode())
            
        except Exception as e:
            self.send_error(500, str(e))
    
    def log_message(self, format, *args):
        """自定义日志格式"""
        print(f"[Web] {args[0]}")


def run_server(port: int = 8080):
    """运行服务器"""
    # 切换到 web 目录
    web_dir = Path(__file__).parent / 'web'
    web_dir.mkdir(exist_ok=True)
    import os
    os.chdir(str(web_dir))
    
    db_path = Path(__file__).parent / 'knowledge_graph.db'
    
    # 创建处理器类
    def handler(*args, **kwargs):
        return GraphAPIHandler(*args, db_path=str(db_path), **kwargs)
    
    server = HTTPServer(('0.0.0.0', port), handler)
    print(f"🌐 知识图谱 Web 服务器已启动")
    print(f"📍 访问地址：http://localhost:{port}")
    print(f"📊 API 端点：http://localhost:{port}/api/graph")
    print(f"📊 统计 API: http://localhost:{port}/api/stats")
    print(f"🔍 搜索 API: http://localhost:{port}/api/search?q=AI")
    print(f"\n按 Ctrl+C 停止服务器")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 服务器已停止")
        server.shutdown()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="知识图谱 Web 服务器")
    parser.add_argument('--port', type=int, default=8080, help='端口号')
    args = parser.parse_args()
    
    run_server(args.port)
