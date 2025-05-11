import http.server
import socketserver
import os

# 服务器配置
PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # 添加CORS头以允许跨域资源共享
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

# 启动服务器
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"服务器运行在端口 {PORT}")
    print(f"访问 http://localhost:{PORT} 使用WebGL图片查看器")
    httpd.serve_forever()    