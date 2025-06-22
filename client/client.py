#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import socket
import socketio
import requests
import json
import time
import subprocess
import sys
import os
import threading
from datetime import datetime
import logging
import psutil

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('client.log'),
        logging.StreamHandler()
    ]
)

class SwitchboardClient:
    def __init__(self, server_url="http://localhost:8000", client_name=None):
        self.server_url = server_url
        # 컴퓨터의 실제 호스트명을 사용 (사용자 지정 무시)
        self.client_name = self.get_computer_name()
        self.client_id = None
        self.sio = socketio.Client()
        self.running = False
        
        # 중복 실행 방지를 위한 프로세스 확인
        if not self.check_duplicate_process():
            print(f"❌ 이미 실행 중인 클라이언트가 있습니다. (이름: {self.client_name})")
            logging.error(f"이미 실행 중인 클라이언트가 있습니다. (이름: {self.client_name})")
            sys.exit(1)
        
        # Socket.io 이벤트 핸들러 등록
        self.sio.on('connect', self.on_connect)
        self.sio.on('disconnect', self.on_disconnect)
        self.sio.on('execute_command', self.on_execute_command)
        self.sio.on('connection_check', self.on_connection_check)
        self.sio.on('registration_failed', self.on_registration_failed)
        
        logging.info(f"클라이언트 초기화 완료: {self.client_name}")
    
    def check_duplicate_process(self):
        """같은 이름의 클라이언트가 이미 실행 중인지 확인합니다."""
        try:
            current_pid = os.getpid()
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    # 현재 프로세스는 제외
                    if proc.info['pid'] == current_pid:
                        continue
                    
                    # Python 프로세스인지 확인
                    if proc.info['name'] and 'python' in proc.info['name'].lower():
                        cmdline = proc.info['cmdline']
                        if cmdline and len(cmdline) > 1:
                            # client.py가 실행 중인지 확인
                            if 'client.py' in cmdline[1] or 'start_client.bat' in ' '.join(cmdline):
                                print(f"⚠️ 다른 클라이언트 프로세스 발견: PID {proc.info['pid']}")
                                return False
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    continue
            return True
        except Exception as e:
            print(f"⚠️ 프로세스 확인 중 오류: {e}")
            return True  # 오류 시 실행 허용
    
    def get_computer_name(self):
        """컴퓨터의 실제 호스트명을 가져옵니다."""
        try:
            return socket.gethostname()
        except:
            return f"Client_{os.getpid()}"
    
    def get_local_ip(self):
        """로컬 IP 주소를 가져옵니다."""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"
    
    def register_with_server(self):
        """서버에 클라이언트를 등록합니다."""
        try:
            client_info = {
                'name': self.client_name,
                'ip_address': self.get_local_ip(),
                'port': 8081
            }
            
            response = requests.post(f"{self.server_url}/api/clients", json=client_info, timeout=10)
            
            if response.status_code == 200:
                client_data = response.json()
                self.client_id = client_data['id']
                logging.info(f"서버 등록 성공: ID {self.client_id}")
                return True
            elif response.status_code == 500 and "UNIQUE constraint failed" in response.text:
                # 중복 이름은 괜찮음. 서버에서 이미 알고 있다는 뜻.
                # 소켓 연결 시 정보가 업데이트될 것이므로 성공으로 처리.
                logging.info(f"이미 등록된 클라이언트입니다: {self.client_name}. 연결을 계속합니다.")
                return True
            else:
                logging.error(f"서버 등록 실패: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logging.error(f"서버 등록 중 오류: {e}")
            return False
    
    def connect_socket(self):
        """Socket.io 연결을 설정합니다."""
        try:
            print(f"🔌 소켓 연결 시도: {self.server_url}")
            self.sio.connect(self.server_url)
            self.running = True  # 하트비트 루프를 위해 running 플래그 설정
            print(f"✅ Socket.io 연결 성공: {self.client_name}")
            logging.info("Socket.io 연결 성공")
            return True
        except Exception as e:
            print(f"❌ Socket.io 연결 실패: {e}")
            logging.error(f"Socket.io 연결 실패: {e}")
            return False
    
    def on_connect(self):
        """Socket.io 연결 시 호출됩니다."""
        print(f"🔌 서버에 연결되었습니다: {self.client_name}")
        logging.info("서버에 연결되었습니다")
        
        # 클라이언트 등록
        self.sio.emit('register_client', {
            'name': self.client_name,
            'clientType': 'python'
        })
        print(f"📝 클라이언트 등록 요청 전송: {self.client_name}")
        
        self.start_heartbeat()
    
    def on_disconnect(self):
        """Socket.io 연결 해제 시 호출됩니다."""
        print(f"🔌 서버와의 연결이 해제되었습니다: {self.client_name}")
        logging.info("서버와의 연결이 해제되었습니다")
        
        # 연결 해제되어도 클라이언트는 계속 실행 (하트비트는 계속 보냄)
        print(f"⚠️ 연결이 끊어졌지만 클라이언트는 계속 실행됩니다. 하트비트를 계속 전송합니다.")
    
    def start_heartbeat(self):
        """하트비트 전송을 시작합니다."""
        def heartbeat_loop():
            heartbeat_count = 0
            print(f"💓 하트비트 루프 시작 - 클라이언트: {self.client_name}")
            logging.info(f"하트비트 루프 시작 - 클라이언트: {self.client_name}")
            
            # Ctrl+C로 종료 가능한 하트비트 루프
            while self.running:  # True 대신 self.running 사용
                try:
                    heartbeat_count += 1
                    print(f"💓 하트비트 전송 시도 #{heartbeat_count}: {self.client_name} (연결 상태: {self.sio.connected}) - {datetime.now().strftime('%H:%M:%S')}")
                    
                    # 하트비트 전송 (연결 상태와 관계없이 시도)
                    try:
                        print(f"📤 하트비트 전송 중: {self.client_name} -> 서버")
                        self.sio.emit('heartbeat', {
                            'name': self.client_name
                        })
                        print(f"💓 하트비트 전송 완료 #{heartbeat_count}: {self.client_name} (연결 상태: {self.sio.connected}) - {datetime.now().strftime('%H:%M:%S')}")
                        logging.info(f"하트비트 전송 #{heartbeat_count}: {self.client_name} (연결 상태: {self.sio.connected})")
                    except Exception as heartbeat_error:
                        print(f"⚠️ 하트비트 전송 실패: {heartbeat_error}")
                        # 하트비트 전송 실패해도 계속 시도
                        print(f"⚠️ 하트비트 전송 실패했지만 계속 시도합니다.")
                    
                    time.sleep(5)  # 5초마다 하트비트
                except KeyboardInterrupt:
                    print(f"\n🛑 하트비트 루프에서 사용자에 의해 종료됨: {self.client_name}")
                    break
                except Exception as e:
                    print(f"❌ 하트비트 루프 오류: {e} - {datetime.now().strftime('%H:%M:%S')}")
                    logging.error(f"하트비트 루프 오류: {e}")
                    print(f"⚠️ 하트비트 루프 오류가 발생했지만 계속 실행합니다.")
                    time.sleep(5)
            
            print(f"💓 하트비트 루프 종료: {self.client_name}")
        
        heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)  # daemon=True로 변경
        heartbeat_thread.start()
        print("💓 하트비트 스레드 시작 (5초 간격)")
        logging.info("하트비트 스레드 시작 (5초 간격)")
    
    def on_registration_failed(self, data):
        """서버 등록 실패 시 호출됩니다."""
        reason = data.get('reason', '알 수 없는 이유')
        logging.error(f"서버 등록 실패: {reason}")
        print(f"❌ 서버 등록 실패: {reason}")
        
        # 등록 실패해도 클라이언트는 계속 실행 (하트비트는 계속 보냄)
        print(f"⚠️ 등록 실패했지만 클라이언트는 계속 실행됩니다. 하트비트를 계속 전송합니다.")
    
    def on_execute_command(self, data):
        """서버로부터 명령 실행 요청을 받습니다."""
        try:
            command = data.get('command')
            target_client_id = data.get('clientId')
            target_client_name = data.get('clientName')
            preset_id = data.get('presetId')
            
            print(f"📨 명령어 수신: {data}")
            logging.info(f"명령어 수신: {data}")
            
            # 클라이언트 ID나 이름으로 대상 확인
            print(f"🔍 대상 확인: 받은 ID={target_client_id}, 내 ID={self.client_id}, 받은 이름={target_client_name}, 내 이름={self.client_name}")
            
            if target_client_id and target_client_id != self.client_id:
                print(f"❌ 클라이언트 ID 불일치: {target_client_id} != {self.client_id}")
                logging.info(f"클라이언트 ID 불일치로 명령 무시: {target_client_id} != {self.client_id}")
                return
            if target_client_name and target_client_name != self.client_name:
                print(f"❌ 클라이언트 이름 불일치: {target_client_name} != {self.client_name}")
                logging.info(f"클라이언트 이름 불일치로 명령 무시: {target_client_name} != {self.client_name}")
                return
            
            print(f"✅ 명령어 대상 확인 완료 - 실행 시작")
            logging.info(f"명령 실행 요청: {command}")
            print(f"⚡ 명령 실행: {command}")
            
            result = self.execute_command(command)
            
            print(f"📤 실행 결과 전송: {result}")
            self.sio.emit('execution_result', {
                'executionId': data.get('executionId'),
                'clientId': self.client_id,
                'clientName': self.client_name,
                'command': command,
                'result': result,
                'presetId': preset_id,
                'timestamp': datetime.now().isoformat()
            })
            
        except Exception as e:
            error_msg = f"명령 실행 중 오류: {e}"
            logging.error(error_msg)
            print(f"❌ {error_msg}")
            
            self.sio.emit('execution_result', {
                'executionId': data.get('executionId'),
                'clientId': self.client_id,
                'clientName': self.client_name,
                'command': data.get('command'),
                'result': {'error': error_msg},
                'presetId': data.get('presetId'),
                'timestamp': datetime.now().isoformat()
            })
    
    def on_connection_check(self, data):
        """서버의 연결 확인 요청에 응답합니다."""
        try:
            client_name = data.get('clientName')
            print(f"🔍 연결 확인 요청 수신: {client_name} (내 이름: {self.client_name})")
            logging.info(f"연결 확인 요청 수신: {client_name} (내 이름: {self.client_name})")
            
            if client_name == self.client_name:
                self.sio.emit('connection_check_response', {
                    'clientName': self.client_name
                })
                print(f"✅ 연결 확인 응답 전송: {self.client_name}")
                logging.info(f"연결 확인 응답 전송: {self.client_name}")
            else:
                print(f"⚠️ 다른 클라이언트 요청 무시: {client_name}")
                logging.info(f"다른 클라이언트 요청 무시: {client_name}")
        except Exception as e:
            print(f"❌ 연결 확인 응답 실패: {e}")
            logging.error(f"연결 확인 응답 실패: {e}")
    
    def execute_command(self, command):
        """명령을 실행합니다."""
        try:
            logging.info(f"명령 실행: {command}")
            
            if command.startswith('system://'):
                return self.execute_system_command(command)
            else:
                return self.execute_system_command(f"system://{command}")
                
        except Exception as e:
            logging.error(f"명령 실행 실패: {e}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def execute_system_command(self, command):
        """시스템 명령을 실행합니다."""
        try:
            system_command = command.replace('system://', '')
            
            process = subprocess.Popen(
                system_command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            stdout, stderr = process.communicate(timeout=30)
            
            return {
                'success': process.returncode == 0,
                'stdout': stdout,
                'stderr': stderr,
                'return_code': process.returncode,
                'timestamp': datetime.now().isoformat()
            }
            
        except subprocess.TimeoutExpired:
            process.kill()
            return {
                'success': False,
                'error': '명령 실행 시간 초과',
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def start(self):
        """클라이언트를 시작합니다."""
        try:
            logging.info("클라이언트 시작")
            print(f"🚀 Switchboard Plus Client 시작: {self.client_name}")
            
            # 서버에 등록 시도 (실패해도 계속 실행)
            try:
                if self.register_with_server():
                    print("✅ 서버 등록 성공")
                else:
                    print("⚠️ 서버 등록 실패, 독립 실행 모드")
            except Exception as e:
                print(f"⚠️ 서버 등록 중 오류: {e}, 독립 실행 모드")
            
            # Socket.io 연결 시도 (실패해도 계속 실행)
            try:
                if self.connect_socket():
                    print("✅ Socket.io 연결 성공")
                else:
                    print("⚠️ Socket.io 연결 실패, 독립 실행 모드")
            except Exception as e:
                print(f"⚠️ Socket.io 연결 중 오류: {e}, 독립 실행 모드")
            
            # 클라이언트는 항상 실행 상태로 유지
            self.running = True
            print(f"✅ 클라이언트 실행 상태 설정: {self.client_name}")
            
            # Ctrl+C로 종료 가능한 메인 루프
            while self.running:  # True 대신 self.running 사용
                try:
                    time.sleep(1)
                except KeyboardInterrupt:
                    print("\n🛑 사용자에 의해 종료됨")
                    self.running = False
                    break
                except Exception as e:
                    print(f"❌ 메인 루프 오류: {e}")
                    print(f"⚠️ 메인 루프 오류가 발생했지만 계속 실행합니다.")
                    time.sleep(1)
                
        except KeyboardInterrupt:
            print("\n🛑 사용자에 의해 종료됨")
        except Exception as e:
            logging.error(f"클라이언트 실행 중 오류: {e}")
            print(f"❌ 클라이언트 실행 중 오류: {e}")
            # 오류가 발생해도 클라이언트는 계속 실행
            print(f"⚠️ 오류가 발생했지만 클라이언트는 계속 실행됩니다.")
            while self.running:
                try:
                    time.sleep(1)
                except KeyboardInterrupt:
                    print("\n🛑 사용자에 의해 종료됨")
                    break
        finally:
            self.stop()
    
    def stop(self):
        """클라이언트를 중지합니다."""
        print(f"🛑 클라이언트 종료 중: {self.client_name}")
        self.running = False
        
        try:
            if self.sio.connected:
                print(f"🔌 소켓 연결 해제 중: {self.client_name}")
                self.sio.disconnect()
                print(f"✅ 소켓 연결 해제 완료: {self.client_name}")
        except Exception as e:
            print(f"⚠️ 소켓 연결 해제 중 오류: {e}")
        
        logging.info("클라이언트 종료")
        print(f"✅ 클라이언트 종료 완료: {self.client_name}")

def main():
    """메인 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Switchboard Plus Client')
    parser.add_argument('--server', default='http://localhost:8000', help='서버 URL')
    
    args = parser.parse_args()
    
    try:
        print(f"서버: {args.server}")
        
        client = SwitchboardClient(
            server_url=args.server
        )
        
        print(f"컴퓨터 이름: {client.client_name}")
        
        client.start()
        
    except KeyboardInterrupt:
        print("\n🛑 사용자에 의해 종료됨")
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("✅ 클라이언트 종료")

if __name__ == "__main__":
    main() 