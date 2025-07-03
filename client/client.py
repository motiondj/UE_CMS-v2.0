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
import argparse

# psutil을 선택적으로 import
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
    print("⚠️ psutil 모듈을 사용할 수 없습니다. 기본 기능으로 실행됩니다.")

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('client.log'),
        logging.StreamHandler()
    ]
)

class UECMSClient:
    def __init__(self, server_url="http://localhost:8000", client_name=None):
        self.server_url = server_url
        self.client_name = client_name or self.get_computer_name()
        self.client_id = None
        # Socket.IO 클라이언트 설정 (문서 2.1 정확히 따름)
        self.sio = socketio.Client(
            reconnection=True,
            reconnection_attempts=0,  # 무한 재시도
            reconnection_delay=1,     # 1초 시작
            reconnection_delay_max=30, # 최대 30초
            randomization_factor=0.5,
            logger=False,
            engineio_logger=False
        )
        # 상태 관리 (문서 2.1 정확히 따름)
        self.running = False
        self.is_registered = False  # 등록 완료 상태 추적 (이름 변경)
        self.should_run = True
        self.start_time = time.time()
        self.running_processes = {}  # 실행 중인 프로세스 추적
        
        # Socket.io 이벤트 핸들러 등록 (문서 2.1 정확히 따름)
        self.setup_events()
        
        logging.info(f"클라이언트 초기화 완료: {self.client_name}")
    
    def setup_events(self):
        """Socket.IO 이벤트 핸들러 설정 (문서 2.1 정확히 따름)"""
        
        # 연결 성공
        self.sio.on('connect', self.on_connect)
        
        # 연결 해제
        self.sio.on('disconnect', self.on_disconnect)
        
        # 등록 성공 응답
        self.sio.on('registration_success', self.on_registration_success)
        
        # 등록 실패 응답
        self.sio.on('registration_failed', self.on_registration_failed)
        
        # 하트비트 응답 (새로 추가)
        self.sio.on('heartbeat_response', self.on_heartbeat_response)
        
        # 서버 종료 알림 (새로 추가)
        self.sio.on('server_shutdown', self.on_server_shutdown)
        
        # 명령 관련
        self.sio.on('execute_command', self.on_execute_command)
        self.sio.on('stop_command', self.on_stop_command)
        self.sio.on('connection_check', self.on_connection_check)
        self.sio.on('power_action', self.on_power_action)
    
    def get_computer_name(self):
        """컴퓨터의 실제 호스트명을 가져옵니다."""
        try:
            return socket.gethostname()
        except:
            return f"Client_{os.getpid()}"
    
    def get_local_ip(self):
        """고정IP 환경 전용: 반드시 사설 네트워크 IP만 반환 (192.168.x.x, 10.x.x.x, 172.x.x.x)"""
        import psutil
        print(f"🔍 [고정IP] 네트워크 인터페이스에서 사설 IP 탐색...")
        logging.info("[고정IP] 네트워크 인터페이스에서 사설 IP 탐색...")
        for iface, addrs in psutil.net_if_addrs().items():
            for addr in addrs:
                if addr.family == socket.AF_INET and not addr.address.startswith("127."):
                    if (addr.address.startswith("192.168.") or 
                        addr.address.startswith("10.") or 
                        addr.address.startswith("172.")):
                        print(f"✅ [고정IP] 사설 IP 반환: {addr.address} ({iface})")
                        logging.info(f"[고정IP] 사설 IP 반환: {addr.address} ({iface})")
                        return addr.address
        print("❌ [고정IP] 사설 IP를 찾지 못했습니다! 네트워크 설정을 확인하세요.")
        logging.error("[고정IP] 사설 IP를 찾지 못했습니다! 네트워크 설정을 확인하세요.")
        raise RuntimeError("사설 네트워크 IP를 찾지 못했습니다. 네트워크 연결을 확인하세요.")
    
    def check_duplicate_process(self):
        """같은 이름의 클라이언트가 이미 실행 중인지 확인합니다."""
        # 일시적으로 중복 검사 비활성화
        print("⚠️ 중복 프로세스 검사 비활성화됨")
        return True
        
        # 기존 검사 로직 (주석 처리)
        """
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
                            # client.py가 실행 중인지 확인 (정확한 파일명만 검사)
                            cmdline_str = ' '.join(cmdline)
                            if 'client.py' in cmdline_str and 'UECMSClient' in cmdline_str:
                                print(f"⚠️ 다른 클라이언트 프로세스 발견: PID {proc.info['pid']}")
                                print(f"   명령줄: {cmdline_str}")
                                return False
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    continue
            return True
        except Exception as e:
            print(f"⚠️ 프로세스 확인 중 오류: {e}")
            return True  # 오류 시 실행 허용
        """
    
    def register_with_server(self):
        """서버에 클라이언트를 등록합니다."""
        try:
            client_info = {
                'name': self.client_name,
                'ip_address': self.get_local_ip(),
                'port': 8081
            }
            print(f"📝 서버 등록 시도: {self.client_name} (IP: {client_info['ip_address']})")
            logging.info(f"서버 등록 시도: {self.client_name} (IP: {client_info['ip_address']})")
            response = requests.post(f"{self.server_url}/api/clients", json=client_info, timeout=10)
            if response.status_code == 200:
                client_data = response.json()
                self.client_id = client_data['id']
                logging.info(f"서버 등록 성공: ID {self.client_id}")
                print(f"✅ 서버 등록 성공: ID {self.client_id}")
                self.registration_completed = True
                return True
            else:
                logging.error(f"서버 등록 실패: {response.status_code} - {response.text}")
                print(f"❌ 서버 등록 실패: {response.status_code}")
                return False
        except Exception as e:
            logging.error(f"서버 등록 중 오류: {e}")
            print(f"❌ 서버 등록 중 오류: {e}")
            return False
    
    def connect_socket(self):
        """Socket.io 연결을 설정합니다. (문서 2.1 정확히 따름)"""
        try:
            # HTTP URL을 Socket.IO URL로 변환
            socket_url = self.server_url.replace('http://', '').replace('https://', '')
            print(f"🔌 소켓 연결 시도: {socket_url}")
            logging.info(f"소켓 연결 시도: {socket_url}")
            
            # Socket.IO 연결 설정 (문서대로 단순화)
            self.sio.connect(f"http://{socket_url}")
            self.running = True
            print(f"✅ Socket.io 연결 성공: {self.client_name}")
            logging.info(f"Socket.io 연결 성공: {self.client_name}")
            return True
        except Exception as e:
            print(f"❌ Socket.io 연결 실패: {e}")
            logging.error(f"Socket.io 연결 실패: {e}")
            return False
    
    def on_connect(self):
        try:
            print(f"🔌 서버에 연결되었습니다: {self.client_name}")
            logging.info(f"서버에 연결되었습니다: {self.client_name}")
            
            # IP 주소 가져오기
            try:
                ip_address = self.get_local_ip()
                print(f"📡 IP 주소 획득: {ip_address}")
                logging.info(f"IP 주소 획득: {ip_address}")
            except Exception as e:
                print(f"❌ IP 주소 획득 실패: {e}")
                logging.error(f"IP 주소 획득 실패: {e}")
                ip_address = "127.0.0.1"  # 기본값 사용
            
            # 등록 데이터 준비
            registration_data = {
                'name': self.client_name,
                'ip_address': ip_address,
                'clientType': 'python'
            }
            print(f"📝 등록 데이터 준비: {registration_data}")
            logging.info(f"등록 데이터 준비: {registration_data}")
            
            # 등록 요청 전송
            self.register_client(registration_data)
            
        except Exception as e:
            print(f"❌ on_connect 처리 중 오류: {e}")
            logging.error(f"on_connect 처리 중 오류: {e}")
    
    def register_client(self, registration_data=None):
        """서버에 클라이언트 등록 (문서 2.2 정확히 따름)"""
        try:
            if registration_data is None:
                registration_data = {
                    'name': self.client_name,
                    'clientType': 'python',
                    'ip_address': self.get_local_ip(),
                    'version': '2.0',
                    'capabilities': ['unreal_engine', 'file_transfer'],
                    'timestamp': time.time()
                }
            
            print(f"📝 클라이언트 등록 요청: {registration_data}")
            logging.info(f"클라이언트 등록 요청: {registration_data}")
            self.sio.emit('register_client', registration_data)
            
        except Exception as e:
            print(f"❌ 등록 요청 실패: {e}")
            logging.error(f"등록 요청 실패: {e}")
            # 5초 후 재시도
            threading.Timer(5.0, self.register_client).start()
            
            # 하트비트 시작
            self.start_heartbeat()
            
        except Exception as e:
            print(f"❌ on_connect 처리 중 오류: {e}")
            logging.error(f"on_connect 처리 중 오류: {e}")
    
    def start_heartbeat(self):
        def heartbeat_loop():
            print(f"[하트비트] 루프 시작: {self.client_name}")
            while self.running:
                try:
                    # 소켓 연결 상태 확인
                    if not self.sio.connected:
                        print(f"[하트비트] 소켓 연결되지 않음, 재연결 시도...")
                        logging.warning(f"[하트비트] 소켓 연결되지 않음, 재연결 시도...")
                        try:
                            self.connect_socket()
                            time.sleep(2)  # 재연결 후 잠시 대기
                            continue
                        except Exception as e:
                            print(f"[하트비트] 재연결 실패: {e}")
                            logging.error(f"[하트비트] 재연결 실패: {e}")
                            time.sleep(5)  # 재연결 실패 시 더 오래 대기
                            continue
                    
                    ip = self.get_local_ip()
                    current_time = datetime.now().strftime("%H:%M:%S")
                    print(f"[하트비트] 전송 시작: 이름={self.client_name}, IP={ip}, 시간={current_time}")
                    logging.info(f"[하트비트] 전송 시작: 이름={self.client_name}, IP={ip}, 시간={current_time}")
                    
                    heartbeat_data = {
                        'clientName': self.client_name,
                        'ip_address': ip,
                        'timestamp': time.time(),
                        'status': 'online',
                        'uptime': time.time() - self.start_time,
                        'process_count': len(self.running_processes)
                    }
                    print(f"[하트비트] 데이터: {heartbeat_data}")
                    
                    # 소켓 연결 상태 재확인 후 전송
                    if self.sio.connected:
                        self.sio.emit('heartbeat', heartbeat_data)
                        print(f"[하트비트] 전송 완료: {self.client_name}")
                    else:
                        print(f"[하트비트] 소켓 연결 끊어짐, 전송 건너뜀")
                        logging.warning(f"[하트비트] 소켓 연결 끊어짐, 전송 건너뜀")
                    
                    time.sleep(30)  # 30초마다 하트비트 전송 (문서 3.1 정확히 따름)
                except Exception as e:
                    print(f"[하트비트] 전송 오류: {e}")
                    logging.error(f"[하트비트] 전송 오류: {e}")
                    time.sleep(2)  # 오류 시 2초 후 재시도
        import threading
        heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)
        heartbeat_thread.start()
    
    def on_disconnect(self):
        """서버와 연결이 끊어짐 (문서 2.1 정확히 따름)"""
        try:
            print("❌ 서버와 연결이 끊어짐")
            logging.info("서버와 연결이 끊어짐")
            self.is_registered = False
            # 재연결은 Socket.IO 설정으로 자동 처리됨
        except Exception as e:
            print(f"❌ on_disconnect 처리 중 오류: {e}")
            logging.error(f"on_disconnect 처리 중 오류: {e}")
    
    def on_registration_success(self, data):
        """서버에서 등록 성공 알림을 받았을 때 호출됩니다. (문서 2.1 정확히 따름)"""
        try:
            print(f"✅ 서버 등록 성공: {data}")
            logging.info(f"서버 등록 성공: {data}")
            self.is_registered = True
        except Exception as e:
            print(f"❌ 서버 등록 성공 처리 중 오류: {e}")
            logging.error(f"서버 등록 성공 처리 중 오류: {e}")
    
    def on_registration_failed(self, data):
        """서버에서 등록 실패 알림을 받았을 때 호출됩니다. (문서 2.1 정확히 따름)"""
        try:
            error_message = data.get('message', '등록 실패')
            print(f"❌ 서버 등록 실패: {error_message}")
            logging.error(f"서버 등록 실패: {error_message}")
            self.is_registered = False
            # 5초 후 재등록 시도
            threading.Timer(5.0, self.register_client).start()
        except Exception as e:
            print(f"❌ 서버 등록 실패 처리 중 오류: {e}")
            logging.error(f"서버 등록 실패 처리 중 오류: {e}")
    
    def on_heartbeat_response(self, data):
        """하트비트 응답 처리 (문서 3.2 정확히 따름)"""
        try:
            if data['status'] == 'ok':
                print(f"💓 하트비트 응답 수신: {data['message']}")
                logging.info(f"하트비트 응답 수신: {data['message']}")
            else:
                print(f"⚠️ 하트비트 오류: {data['message']}")
                logging.warning(f"하트비트 오류: {data['message']}")
                if data.get('shouldReconnect'):
                    self.reconnect()
        except Exception as e:
            print(f"❌ 하트비트 응답 처리 중 오류: {e}")
            logging.error(f"하트비트 응답 처리 중 오류: {e}")
    
    def on_server_shutdown(self, data):
        """서버 종료 알림 처리 (문서 4.1 정확히 따름)"""
        try:
            print(f"🚨 서버 종료 알림: {data['message']}")
            logging.info(f"서버 종료 알림: {data['message']}")
            
            reconnect_after = data.get('reconnectAfter', 5000)
            print(f"⏰ {reconnect_after/1000}초 후 재연결 시도 예정")
            logging.info(f"{reconnect_after/1000}초 후 재연결 시도 예정")
            
            # 지정된 시간 후 재연결 시도
            threading.Timer(
                reconnect_after/1000, 
                self.reconnect
            ).start()
        except Exception as e:
            print(f"❌ 서버 종료 알림 처리 중 오류: {e}")
            logging.error(f"서버 종료 알림 처리 중 오류: {e}")
    
    def reconnect(self):
        """수동 재연결 (문서 4.1 정확히 따름)"""
        try:
            if self.sio.connected:
                self.sio.disconnect()
            
            print("🔄 재연결 시도 중...")
            logging.info("재연결 시도 중...")
            self.is_registered = False
            
            # 재연결
            if self.connect_socket():
                print("✅ 재연결 성공")
                logging.info("재연결 성공")
                # 재연결 성공 알림
                self.sio.emit('reconnection_success', {
                    'clientName': self.client_name,
                    'timestamp': time.time()
                })
            else:
                print("❌ 재연결 실패")
                logging.error("재연결 실패")
                
        except Exception as e:
            print(f"❌ 재연결 오류: {e}")
            logging.error(f"재연결 오류: {e}")
    
    def on_execute_command(self, data):
        """서버로부터 명령 실행 요청을 받습니다."""
        try:
            command = data.get('command')
            target_client_name = data.get('clientName')
            preset_id = data.get('presetId')
            
            print(f"📨 명령어 수신: {data}")
            logging.info(f"명령어 수신: {data}")
            
            # 클라이언트 이름으로 대상 확인
            print(f"🔍 대상 확인: 받은 이름={target_client_name}, 내 이름={self.client_name}")
            
            if target_client_name and target_client_name != self.client_name:
                print(f"❌ 클라이언트 이름 불일치: {target_client_name} != {self.client_name}")
                logging.info(f"클라이언트 이름 불일치로 명령 무시: {target_client_name} != {self.client_name}")
                return
            
            print(f"✅ 명령어 실행 대상 확인됨: {self.client_name}")
            
            # 별도 스레드에서 명령 실행
            def execute_command_async():
                try:
                    print(f"🚀 명령어 실행 시작: {command}")
                    
                    # 프리셋 ID 저장
                    self.current_preset_id = preset_id
                    print(f"📝 현재 프리셋 ID 설정: {preset_id}")
                    
                    result = self.execute_command(command)
                    print(f"✅ 명령어 실행 완료: {result}")
                    
                    # 실행 결과를 서버에 전송 (성공 상태)
                    self.sio.emit('execution_result', {
                        'executionId': data.get('executionId'),
                        'clientId': self.client_id,
                        'clientName': self.client_name,
                        'command': command,
                        'result': result,
                        'presetId': preset_id,
                        'status': 'completed',  # 명시적으로 완료 상태 전송
                        'timestamp': datetime.now().isoformat()
                    })
                    
                except Exception as e:
                    error_msg = f"명령 실행 중 오류: {e}"
                    logging.error(error_msg)
                    print(f"❌ {error_msg}")
                    
                    # 오류 시 프리셋 ID 초기화
                    self.current_preset_id = None
                    
                    self.sio.emit('execution_result', {
                        'executionId': data.get('executionId'),
                        'clientId': self.client_id,
                        'clientName': self.client_name,
                        'command': command,
                        'result': {'error': error_msg},
                        'presetId': preset_id,
                        'status': 'failed',  # 실패 상태 전송
                        'timestamp': datetime.now().isoformat()
                    })
            
            # 별도 스레드에서 명령 실행
            execution_thread = threading.Thread(target=execute_command_async, daemon=True)
            execution_thread.start()
            print(f"🔄 명령 실행을 별도 스레드에서 시작: {command}")
            
        except Exception as e:
            error_msg = f"명령 실행 요청 처리 중 오류: {e}"
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
        """서버의 연결 확인 요청에 응답합니다. (문서 정확히 따름)"""
        try:
            client_name = data.get('clientName')
            print(f"🔍 연결 확인 요청 수신: {client_name} (내 이름: {self.client_name})")
            logging.info(f"연결 확인 요청 수신: {client_name} (내 이름: {self.client_name})")
            
            if client_name == self.client_name:
                # 즉시 응답 (문서 3.2 정확히 따름)
                response_data = {
                    'clientName': self.client_name,
                    'timestamp': time.time(),
                    'status': 'alive',
                    'received_at': data.get('timestamp')
                }
                
                self.sio.emit('connection_check_response', response_data)
                print(f"✅ 연결 확인 응답 전송: {self.client_name}")
                logging.info(f"연결 확인 응답 전송: {self.client_name}")
            else:
                print(f"⚠️ 다른 클라이언트 요청 무시: {client_name}")
                logging.info(f"다른 클라이언트 요청 무시: {client_name}")
        except Exception as e:
            print(f"❌ 연결 확인 응답 실패: {e}")
            logging.error(f"연결 확인 응답 실패: {e}")
    
    def on_stop_command(self, data):
        """정지 명령을 받았을 때 호출됩니다."""
        try:
            client_name = data.get('clientName', '')
            preset_id = data.get('presetId')
            
            if client_name != self.client_name:
                return  # 다른 클라이언트용 명령이면 무시
            
            print(f"🛑 정지 명령 수신: {self.client_name}")
            logging.info(f"정지 명령 수신: {self.client_name}")
            
            # 실행 중인 프로세스 정지
            stopped_count = self.stop_running_processes()
            
            # 정지 결과 전송
            self.sio.emit('stop_result', {
                'clientName': self.client_name,
                'clientId': self.client_id,
                'presetId': preset_id,
                'stoppedPresetId': self.current_preset_id,
                'result': {
                    'success': True,
                    'stopped_processes': stopped_count,
                    'message': f'{stopped_count}개 프로세스가 정지되었습니다.'
                },
                'timestamp': datetime.now().isoformat()
            })
            
            # 현재 프리셋 ID 초기화
            self.current_preset_id = None
            
            print(f"✅ 정지 명령 완료: {stopped_count}개 프로세스 정지")
            
        except Exception as e:
            logging.error(f"정지 명령 처리 중 오류: {e}")
            self.sio.emit('stop_result', {
                'clientName': self.client_name,
                'clientId': self.client_id,
                'presetId': data.get('preset_id'),
                'stoppedPresetId': self.current_preset_id,
                'result': {
                    'success': False,
                    'error': str(e)
                },
                'timestamp': datetime.now().isoformat()
            })
    
    def on_power_action(self, data):
        """전원 액션 요청을 받았을 때 호출됩니다."""
        try:
            action = data.get('action', '')
            client_name = data.get('client_name', '')
            
            if client_name != self.client_name:
                return  # 다른 클라이언트용 명령이면 무시
            
            print(f"⚡ 전원 액션 요청: {action}")
            logging.info(f"전원 액션 요청: {action}")
            
            if action == 'shutdown':
                self.shutdown_system()
            elif action == 'restart':
                self.restart_system()
            else:
                print(f"⚠️ 알 수 없는 전원 액션: {action}")
                logging.warning(f"알 수 없는 전원 액션: {action}")
                
        except Exception as e:
            logging.error(f"전원 액션 처리 중 오류: {e}")
    
    def shutdown_system(self):
        """시스템을 종료합니다."""
        try:
            print("🛑 시스템 종료 시작")
            
            # 실행 중인 프로세스들 정지
            self.stop_running_processes()
            
            # 시스템 종료 명령 실행
            if os.name == 'nt':  # Windows
                subprocess.run(['shutdown', '/s', '/t', '0'], check=True)
            else:  # Linux/macOS
                subprocess.run(['shutdown', '-h', 'now'], check=True)
            
            return True
        except Exception as e:
            print(f"❌ 시스템 종료 실패: {e}")
            logging.error(f"시스템 종료 실패: {e}")
            return False
    
    def restart_system(self):
        """시스템을 재부팅합니다."""
        try:
            print("🔄 시스템 재부팅 시작")
            
            # 실행 중인 프로세스들 정지
            self.stop_running_processes()
            
            # 시스템 재부팅 명령 실행
            if os.name == 'nt':  # Windows
                subprocess.run(['shutdown', '/r', '/t', '0'], check=True)
            else:  # Linux/macOS
                subprocess.run(['reboot'], check=True)
            
            return True
        except Exception as e:
            print(f"❌ 시스템 재부팅 실패: {e}")
            logging.error(f"시스템 재부팅 실패: {e}")
            return False
    
    def add_running_process(self, process_name, pid, command):
        """실행 중인 프로세스를 추적 목록에 추가합니다."""
        try:
            self.running_processes[process_name] = {
                'pid': pid,
                'command': command,
                'start_time': datetime.now().isoformat()
            }
            print(f"📝 프로세스 추적 시작: {process_name} (PID: {pid})")
            logging.info(f"프로세스 추적 시작: {process_name} (PID: {pid})")
        except Exception as e:
            print(f"❌ 프로세스 추적 추가 실패: {e}")
            logging.error(f"프로세스 추적 추가 실패: {e}")
    
    def remove_running_process(self, process_name):
        """실행 중인 프로세스를 추적 목록에서 제거합니다."""
        try:
            if process_name in self.running_processes:
                removed = self.running_processes.pop(process_name)
                print(f"📝 프로세스 추적 종료: {process_name} (PID: {removed['pid']})")
                logging.info(f"프로세스 추적 종료: {process_name} (PID: {removed['pid']})")
                return removed
        except Exception as e:
            print(f"❌ 프로세스 추적 제거 실패: {e}")
            logging.error(f"프로세스 추적 제거 실패: {e}")
        return None
    
    def check_process_status(self):
        """실행 중인 프로세스들의 상태를 확인합니다."""
        if not PSUTIL_AVAILABLE:
            return {'running': 0, 'crashed': 0}
            
        try:
            running_count = 0
            crashed_count = 0
            
            for process_name, process_info in self.running_processes.items():
                try:
                    pid = process_info['pid']
                    proc = psutil.Process(pid)
                    
                    if proc.is_running():
                        running_count += 1
                        print(f"✅ {process_name} 실행 중 (PID: {pid})")
                    else:
                        crashed_count += 1
                        print(f"⚠️ {process_name} 비정상 종료 (PID: {pid})")
                        # 추적 목록에서 제거
                        self.remove_running_process(process_name)
                        
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    crashed_count += 1
                    print(f"⚠️ {process_name} 프로세스 없음 (PID: {process_info.get('pid', 'Unknown')})")
                    # 추적 목록에서 제거
                    self.remove_running_process(process_name)
                except Exception as e:
                    print(f"⚠️ {process_name} 상태 확인 중 오류: {e}")
            
            return {
                'running': running_count,
                'crashed': crashed_count
            }
            
        except Exception as e:
            print(f"❌ 프로세스 상태 확인 중 오류: {e}")
            return {'running': 0, 'crashed': 0}
    
    def start_process_monitor(self):
        """프로세스 모니터링을 시작합니다."""
        if not PSUTIL_AVAILABLE:
            print("⚠️ psutil을 사용할 수 없어 프로세스 모니터링을 건너뜁니다.")
            return
            
        def monitor_loop():
            print(f"🔍 프로세스 모니터링 시작: {self.client_name}")
            logging.info(f"프로세스 모니터링 시작: {self.client_name}")
            
            while self.running:
                try:
                    # 프로세스 상태 확인
                    status = self.check_process_status()
                    
                    # 상태 정보를 서버에 전송
                    if self.sio.connected:
                        self.sio.emit('process_status', {
                            'name': self.client_name,
                            'status': status
                        })
                    
                    # 10초마다 확인
                    time.sleep(10)
                    
                except Exception as e:
                    print(f"⚠️ 프로세스 모니터링 중 오류: {e}")
                    time.sleep(10)
        
        # 별도 스레드에서 모니터링 실행
        self.process_monitor_thread = threading.Thread(target=monitor_loop, daemon=True)
        self.process_monitor_thread.start()
        print(f"✅ 프로세스 모니터링 스레드 시작: {self.client_name}")
        logging.info(f"프로세스 모니터링 스레드 시작: {self.client_name}")
    
    def stop_running_processes(self):
        """실행 중인 프로세스들을 정지합니다."""
        try:
            print("🛑 실행 중인 프로세스 정지 시작")
            
            # Windows에서 실행 중인 Unreal Engine 프로세스 찾기 및 정지
            if PSUTIL_AVAILABLE:
                # Unreal Engine 관련 프로세스 이름들
                target_processes = [
                    'MyProject.exe',
                    'UnrealEditor.exe',
                    'UE4Editor.exe',
                    'UE5Editor.exe'
                ]
                
                stopped_count = 0
                
                for proc in psutil.process_iter(['pid', 'name']):
                    try:
                        if proc.info['name'] in target_processes:
                            print(f"🛑 프로세스 정지: {proc.info['name']} (PID: {proc.info['pid']})")
                            proc.terminate()
                            stopped_count += 1
                            
                            # 추적 목록에서도 제거
                            self.remove_running_process(proc.info['name'])
                            
                    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                        pass
                
                print(f"✅ 프로세스 정지 완료: {stopped_count}개 프로세스")
                return stopped_count
            
        except Exception as e:
            print(f"❌ 프로세스 정지 중 오류: {e}")
            return 0
    
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
            
            # 프로세스 이름 추출 (명령어에서 실행 파일명 추출)
            process_name = self.extract_process_name(system_command)
            
            # 백그라운드에서 실행 (communicate 사용하지 않음)
            process = subprocess.Popen(
                system_command,
                shell=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                text=True
            )
            
            # 실행된 프로세스를 추적 목록에 추가
            if process_name:
                self.add_running_process(process_name, process.pid, system_command)
            
            print(f"✅ 백그라운드 프로세스 시작: {process_name} (PID: {process.pid})")
            
            return {
                'success': True,
                'process_id': process.pid,
                'process_name': process_name,
                'message': f'프로세스가 백그라운드에서 실행 중입니다 (PID: {process.pid})',
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            # 오류 시에도 프로세스 추적 제거
            if process_name:
                self.remove_running_process(process_name)
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def extract_process_name(self, command):
        """명령어에서 프로세스 이름을 추출합니다."""
        try:
            # 명령어에서 실행 파일명 추출
            parts = command.strip().split()
            if parts:
                # 첫 번째 부분이 실행 파일 경로
                exe_path = parts[0]
                # 경로에서 파일명만 추출
                process_name = os.path.basename(exe_path)
                return process_name
        except Exception as e:
            print(f"⚠️ 프로세스 이름 추출 실패: {e}")
        return None
    
    def start(self):
        """클라이언트를 시작합니다."""
        try:
            logging.info("클라이언트 시작")
            print(f"🚀 UE CMS Client 시작: {self.client_name}")
            
            # 서버에 등록
            if self.register_with_server():
                print("✅ 서버 등록 성공")
            else:
                print("⚠️ 서버 등록 실패")
            
            # Socket.io 연결
            if self.connect_socket():
                print("✅ Socket.io 연결 성공")
                
                # 연결 완료 대기 (최대 10초)
                wait_time = 0
                while not self.sio.connected and wait_time < 10:
                    time.sleep(0.5)
                    wait_time += 0.5
                
                if self.sio.connected:
                    print("✅ Socket.IO 연결 확인됨")
                else:
                    print("⚠️ Socket.IO 연결 확인 실패")
            else:
                print("⚠️ Socket.io 연결 실패")
            
            # 메인 루프
            while self.running:
                try:
                    time.sleep(1)
                except KeyboardInterrupt:
                    print("\n🛑 사용자에 의해 종료됨")
                    break
                
        except KeyboardInterrupt:
            print("\n🛑 사용자에 의해 종료됨")
        except Exception as e:
            logging.error(f"클라이언트 실행 중 오류: {e}")
            print(f"❌ 클라이언트 실행 중 오류: {e}")
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
    """메인 함수 - 서버 IP 입력 및 클라이언트 실행"""
    print("🚀 UE CMS Client")
    print("=" * 50)
    
    # 명령행 인수 파싱
    parser = argparse.ArgumentParser(description='UE CMS Client')
    parser.add_argument('--server', '-s', help='서버 URL (예: http://192.168.1.100:8000)')
    parser.add_argument('--name', '-n', help='클라이언트 이름')
    parser.add_argument('--config', '-c', default='config.json', help='설정 파일 경로')
    args = parser.parse_args()
    
    # 설정 파일에서 기본값 로드
    config = load_config(args.config)
    
    # 서버 URL 결정 (명령행 인수 > 설정 파일 > 기본값)
    server_url = args.server or config.get('server_url', 'http://localhost:8000')
    
    # 서버 URL이 기본값이면 사용자에게 입력 요청
    if server_url == 'http://localhost:8000' or server_url == 'http://YOUR_SERVER_IP:8000':
        print("\n📡 서버 연결 설정")
        print("-" * 30)
        
        # 현재 네트워크 정보 표시
        try:
            import psutil
            print("🌐 현재 네트워크 정보:")
            for iface, addrs in psutil.net_if_addrs().items():
                for addr in addrs:
                    if addr.family == socket.AF_INET and not addr.address.startswith("127."):
                        if (addr.address.startswith("192.168.") or 
                            addr.address.startswith("10.") or 
                            addr.address.startswith("172.")):
                            print(f"   📶 {iface}: {addr.address}")
        except:
            pass
        
        print("\n💡 서버 IP 주소를 입력하세요:")
        print("   예시: 192.168.1.100")
        print("   또는 전체 URL: http://192.168.1.100:8000")
        print("   (Enter만 누르면 localhost:8000 사용)")
        
        user_input = input("\n서버 주소: ").strip()
        
        if user_input:
            # IP만 입력한 경우 http:// 추가
            if not user_input.startswith('http'):
                if ':' in user_input:
                    server_url = f"http://{user_input}"
                else:
                    server_url = f"http://{user_input}:8000"
            else:
                server_url = user_input
        
        print(f"✅ 서버 주소 설정: {server_url}")
    
    # 클라이언트 이름 결정
    client_name = args.name or config.get('client_name') or socket.gethostname()
    
    print(f"\n📋 클라이언트 정보:")
    print(f"   서버: {server_url}")
    print(f"   이름: {client_name}")
    print(f"   설정 파일: {args.config}")
    
    # 설정 저장
    save_config(args.config, {
        'server_url': server_url,
        'client_name': client_name,
        'saved_at': datetime.now().isoformat()
    })
    
    print("\n🚀 클라이언트 시작 중...")
    print("=" * 50)
    
    # 클라이언트 생성 및 실행
    client = UECMSClient(server_url=server_url, client_name=client_name)
    
    try:
        client.start()
    except KeyboardInterrupt:
        print("\n⏹️ 사용자에 의해 중지됨")
    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        logging.error(f"클라이언트 실행 중 오류: {e}")
    finally:
        client.stop()

def load_config(config_file):
    """설정 파일을 로드합니다."""
    try:
        if os.path.exists(config_file):
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        print(f"⚠️ 설정 파일 로드 실패: {e}")
    return {}

def save_config(config_file, config_data):
    """설정을 파일에 저장합니다."""
    try:
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"⚠️ 설정 파일 저장 실패: {e}")

if __name__ == "__main__":
    main() 