#!/usr/bin/env python3
"""
Switchboard Plus Client
언리얼엔진 nDisplay 클라이언트 제어 프로그램
"""

import socket
import json
import time
import subprocess
import threading
import os
import sys
import platform
from datetime import datetime

# Socket.io 클라이언트
import socketio
import requests

class SwitchboardClient:
    def __init__(self, server_url="http://localhost:8000", client_name=None):
        self.server_url = server_url
        self.client_name = client_name or f"Display_{platform.node()}"
        self.sio = socketio.Client()
        self.connected = False
        self.client_id = None
        self.running = True
        
        # 시스템 정보
        self.system_info = {
            "hostname": platform.node(),
            "platform": platform.system(),
            "version": platform.version(),
            "processor": platform.processor(),
            "ip": self.get_local_ip()
        }
        
        # Socket.io 이벤트 핸들러 등록
        self.sio.on('connect', self.on_connect)
        self.sio.on('disconnect', self.on_disconnect)
        self.sio.on('execute_preset', self.on_execute_preset)
        self.sio.on('ping', self.on_ping)
        
        print(f"🚀 Switchboard Plus Client 시작")
        print(f"📱 클라이언트 이름: {self.client_name}")
        print(f"🖥️  시스템: {self.system_info['platform']} {self.system_info['version']}")
        print(f"🌐 IP 주소: {self.system_info['ip']}")
        print(f"🔗 서버: {self.server_url}")
        print("=" * 50)
    
    def get_local_ip(self):
        """로컬 IP 주소 가져오기"""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"
    
    def connect_to_server(self):
        """서버에 연결"""
        try:
            # HTTP API로 클라이언트 등록
            register_data = {
                "name": self.client_name,
                "ip": self.system_info['ip'],
                "status": "online",
                "system_info": self.system_info
            }
            
            response = requests.post(f"{self.server_url}/api/clients", json=register_data)
            if response.status_code == 200:
                print(f"✅ 서버에 클라이언트 등록 성공")
            else:
                print(f"⚠️  클라이언트 등록 실패: {response.status_code}")
            
            # Socket.io 연결
            self.sio.connect(self.server_url)
            
        except Exception as e:
            print(f"❌ 서버 연결 실패: {e}")
            time.sleep(5)  # 5초 후 재시도
    
    def on_connect(self):
        """Socket.io 연결 성공"""
        self.connected = True
        print(f"🔌 서버에 연결됨")
        
        # 클라이언트 정보 전송
        client_info = {
            "name": self.client_name,
            "ip": self.system_info['ip'],
            "status": "online",
            "system_info": self.system_info
        }
        self.sio.emit('client_info', client_info)
    
    def on_disconnect(self):
        """Socket.io 연결 종료"""
        print(f"🔌 서버 연결 종료")
        self.connected = False
        
        if self.running:
            print("🔄 5초 후 재연결 시도...")
            time.sleep(5)
            self.connect_to_server()
    
    def on_execute_preset(self, data):
        """프리셋 실행 명령 수신"""
        try:
            print(f"⚡ 프리셋 실행 명령 수신: {data}")
            self.execute_preset(data)
        except Exception as e:
            print(f"❌ 프리셋 실행 오류: {e}")
    
    def on_ping(self, data):
        """Ping 명령 수신"""
        try:
            print(f"🏓 Ping 수신: {data}")
            self.send_pong()
        except Exception as e:
            print(f"❌ Ping 응답 오류: {e}")
    
    def send_pong(self):
        """Ping에 대한 Pong 응답"""
        pong_data = {
            "client_name": self.client_name,
            "timestamp": datetime.now().isoformat()
        }
        self.sio.emit('pong', pong_data)
    
    def execute_preset(self, preset_data):
        """프리셋 실행"""
        try:
            preset_name = preset_data.get("name", "Unknown")
            command = preset_data.get("command", "")
            
            print(f"⚡ 프리셋 실행: {preset_name}")
            print(f"📝 명령어: {command}")
            
            if not command:
                print("❌ 실행할 명령어가 없습니다.")
                return
            
            # 명령어 실행
            print(f"🚀 명령어 실행 중...")
            
            # 백그라운드에서 실행
            def run_command():
                try:
                    result = subprocess.run(
                        command,
                        shell=True,
                        capture_output=True,
                        text=True,
                        timeout=30
                    )
                    
                    if result.returncode == 0:
                        print(f"✅ 명령어 실행 성공: {preset_name}")
                        if result.stdout:
                            print(f"📤 출력: {result.stdout}")
                    else:
                        print(f"❌ 명령어 실행 실패: {preset_name}")
                        if result.stderr:
                            print(f"📤 오류: {result.stderr}")
                            
                except subprocess.TimeoutExpired:
                    print(f"⏰ 명령어 실행 시간 초과: {preset_name}")
                except Exception as e:
                    print(f"❌ 명령어 실행 오류: {e}")
            
            # 별도 스레드에서 실행
            thread = threading.Thread(target=run_command)
            thread.daemon = True
            thread.start()
            
        except Exception as e:
            print(f"❌ 프리셋 실행 오류: {e}")
    
    def send_status_update(self):
        """상태 업데이트 전송"""
        if not self.connected:
            return
        
        status_data = {
            "client_name": self.client_name,
            "status": "online",
            "timestamp": datetime.now().isoformat(),
            "system_info": self.system_info
        }
        
        try:
            self.sio.emit('status_update', status_data)
        except Exception as e:
            print(f"❌ 상태 업데이트 전송 실패: {e}")
    
    def run(self):
        """클라이언트 실행"""
        print("🔄 서버 연결 시도...")
        
        # 연결 시도
        while self.running:
            try:
                self.connect_to_server()
                
                # 연결 유지
                while self.connected and self.running:
                    time.sleep(1)
                    
            except KeyboardInterrupt:
                print("\n🛑 사용자에 의해 종료됨")
                self.running = False
                break
            except Exception as e:
                print(f"❌ 연결 실패: {e}")
                time.sleep(5)
        
        print("👋 클라이언트 종료")

def main():
    """메인 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Switchboard Plus Client")
    parser.add_argument("--server", default="http://localhost:8000", help="서버 URL")
    parser.add_argument("--name", help="클라이언트 이름")
    
    args = parser.parse_args()
    
    client = SwitchboardClient(
        server_url=args.server,
        client_name=args.name
    )
    
    try:
        client.run()
    except KeyboardInterrupt:
        print("\n🛑 클라이언트 종료")
    except Exception as e:
        print(f"❌ 클라이언트 오류: {e}")

if __name__ == "__main__":
    main() 