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
        if not self.client_name or str(self.client_name).strip() == "":
            print("❌ 클라이언트 이름이 비어 있습니다. 실행을 중단합니다.")
            logging.error("클라이언트 이름이 비어 있습니다. 실행을 중단합니다.")
            sys.exit(1)
        self.client_id = None
        self.sio = socketio.Client()
        self.running = False
        self.current_preset_id = None  # 현재 실행 중인 프리셋 ID
        
        # 프로세스 모니터링을 위한 변수들 추가
        self.running_processes = {}  # {process_name: {'pid': pid, 'command': command, 'start_time': timestamp}}
        self.process_monitor_thread = None
        
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
        self.sio.on('stop_command', self.on_stop_command)
        self.sio.on('power_action', self.on_power_action)
        
        logging.info(f"클라이언트 초기화 완료: {self.client_name}")
    
    def check_duplicate_process(self):
        """중복 프로세스 실행을 방지합니다."""
        # 중복 실행 방지 비활성화 - 서버에서 중복 연결을 차단하도록 함
        print("✅ 중복 실행 방지 비활성화 - 서버에서 중복 연결 차단")
        return True
    
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
    
    def get_mac_address(self):
        """MAC 주소를 자동으로 수집합니다."""
        try:
            import subprocess
            import re
            
            print("🔍 MAC 주소 수집 시작...")
            logging.info("MAC 주소 수집 시작")
            
            # Windows의 경우
            if os.name == 'nt':
                try:
                    # ipconfig 명령어로 MAC 주소 조회
                    result = subprocess.run(['ipconfig', '/all'], 
                                          capture_output=True, text=True, encoding='cp949')
                    
                    if result.returncode == 0:
                        print(f"✅ ipconfig 명령어 실행 성공")
                        logging.info("ipconfig 명령어 실행 성공")
                        
                        # MAC 주소 패턴 매칭 (한글 Windows 호환)
                        mac_pattern = r'물리적 주소[.\s]*:[\s]*([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})'
                        mac_match = re.search(mac_pattern, result.stdout)
                        
                        if mac_match:
                            mac_address = mac_match.group(0).split(':')[-1].strip()
                            print(f"✅ MAC 주소 수집 성공: {mac_address}")
                            logging.info(f"MAC 주소 수집 성공: {mac_address}")
                            return mac_address
                        else:
                            print("⚠️ ipconfig에서 MAC 주소를 찾을 수 없습니다")
                            logging.warning("ipconfig에서 MAC 주소를 찾을 수 없습니다")
                            
                            # PowerShell 대체 방법
                            try:
                                ps_result = subprocess.run(['powershell', '-Command', 'Get-NetAdapter | Select-Object Name, MacAddress'], 
                                                          capture_output=True, text=True, encoding='utf-8')
                                
                                if ps_result.returncode == 0:
                                    print("✅ PowerShell 명령어 실행 성공")
                                    logging.info("PowerShell 명령어 실행 성공")
                                    
                                    # 첫 번째 활성 어댑터의 MAC 주소 추출
                                    lines = ps_result.stdout.strip().split('\n')
                                    for line in lines[2:]:  # 헤더 제외
                                        if line.strip() and '-' in line:
                                            parts = line.split()
                                            if len(parts) >= 2:
                                                mac_address = parts[-1]
                                                if re.match(r'([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})', mac_address):
                                                    print(f"✅ PowerShell로 MAC 주소 수집 성공: {mac_address}")
                                                    logging.info(f"PowerShell로 MAC 주소 수집 성공: {mac_address}")
                                                    return mac_address
                            except Exception as ps_e:
                                print(f"⚠️ PowerShell MAC 주소 수집 실패: {ps_e}")
                                logging.warning(f"PowerShell MAC 주소 수집 실패: {ps_e}")
                    else:
                        print(f"❌ ipconfig 명령어 실행 실패: {result.returncode}")
                        logging.error(f"ipconfig 명령어 실행 실패: {result.returncode}")
                        
                except Exception as e:
                    print(f"❌ Windows MAC 주소 수집 실패: {e}")
                    logging.error(f"Windows MAC 주소 수집 실패: {e}")
            
            # Linux/macOS의 경우
            else:
                try:
                    # ip link show 명령어로 MAC 주소 조회
                    result = subprocess.run(['ip', 'link', 'show'], 
                                          capture_output=True, text=True)
                    
                    if result.returncode == 0:
                        # MAC 주소 패턴 매칭
                        mac_pattern = r'link/ether\s+([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})'
                        mac_match = re.search(mac_pattern, result.stdout)
                        
                        if mac_match:
                            mac_address = mac_match.group(1)
                            print(f"✅ Linux/macOS MAC 주소 수집 성공: {mac_address}")
                            logging.info(f"Linux/macOS MAC 주소 수집 성공: {mac_address}")
                            return mac_address
                except Exception as e:
                    print(f"❌ Linux/macOS MAC 주소 수집 실패: {e}")
                    logging.error(f"Linux/macOS MAC 주소 수집 실패: {e}")
            
            print("❌ MAC 주소 수집 실패 - 모든 방법 시도 완료")
            logging.error("MAC 주소 수집 실패 - 모든 방법 시도 완료")
            return None
            
        except Exception as e:
            print(f"❌ MAC 주소 수집 중 예외 발생: {e}")
            logging.error(f"MAC 주소 수집 중 예외 발생: {e}")
            return None
    
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
                
                # 등록 성공 후 MAC 주소 전송
                self.send_mac_address_to_server()
                
                return True
            else:
                logging.error(f"서버 등록 실패: {response.status_code} - {response.text}")
                
                # 등록 실패해도 MAC 주소는 무조건 전송
                logging.info("등록 실패했지만 MAC 주소는 전송합니다.")
                self.send_mac_address_to_server()
                
                return False
                
        except Exception as e:
            logging.error(f"서버 등록 중 오류: {e}")
            
            # 예외 발생해도 MAC 주소는 무조건 전송
            logging.info("등록 중 오류가 발생했지만 MAC 주소는 전송합니다.")
            self.send_mac_address_to_server()
            
            return False
    
    def send_mac_address_to_server(self):
        """MAC 주소를 서버에 전송합니다."""
        try:
            print(f"🔍 MAC 주소 서버 전송 시작...")
            logging.info("MAC 주소 서버 전송 시작")
            
            # MAC 주소 수집
            mac_address = self.get_mac_address()
            if not mac_address:
                print(f"❌ MAC 주소 수집 실패")
                logging.error("MAC 주소 수집 실패")
                return False
            
            print(f"📤 MAC 주소 서버 전송 시도: {mac_address}")
            logging.info(f"MAC 주소 서버 전송 시도: {mac_address}")
            
            # 서버에 MAC 주소 전송 (자동 수집 플래그)
            response = requests.put(
                f"{self.server_url}/api/clients/name/{self.client_name}/mac",
                json={
                    'mac_address': mac_address,
                    'is_manual': False  # 자동 수집임을 명시
                },
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ MAC 주소 서버 전송 성공: {mac_address}")
                logging.info(f"MAC 주소 서버 전송 성공: {mac_address}")
                
                # Socket.io 이벤트로도 전송
                if self.sio.connected:
                    self.sio.emit('mac_address_sent', {
                        'clientName': self.client_name,
                        'macAddress': mac_address,
                        'isManual': False
                    })
                
                return True
            else:
                print(f"❌ MAC 주소 서버 전송 실패: {response.status_code} - {response.text}")
                logging.error(f"MAC 주소 서버 전송 실패: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ MAC 주소 서버 전송 오류: {e}")
            logging.error(f"MAC 주소 서버 전송 오류: {e}")
            return False
    
    def connect_socket(self):
        """Socket.io 연결을 설정합니다."""
        try:
            # Socket.IO 연결 설정 (호환성 고려)
            self.sio.connect(
                self.server_url,
                transports=['websocket', 'polling']  # 웹소켓 우선, 폴링 대체
            )
            self.running = True
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
        if not self.client_name or str(self.client_name).strip() == "":
            print("❌ 클라이언트 이름이 비어 있습니다. 소켓 등록을 중단합니다.")
            logging.error("클라이언트 이름이 비어 있습니다. 소켓 등록을 중단합니다.")
            return
        self.sio.emit('register_client', {
            'name': self.client_name,
            'clientType': 'python'
        })
        print(f"📝 클라이언트 등록 요청 전송: {self.client_name}")
        self.send_current_process_status()
        self.start_heartbeat()
        self.start_process_monitor()
        
        # Socket.io 연결 후 MAC 주소 전송 (client_id가 없어도 이름으로 전송)
        self.send_mac_address_to_server()
    
    def send_current_process_status(self):
        """현재 실행 중인 프로세스 정보를 서버에 전송합니다."""
        try:
            # 현재 실행 중인 프로세스 정보 수집
            process_status = self.check_process_status()
            running_processes = []
            
            for process_name, process_info in self.running_processes.items():
                running_processes.append({
                    'name': process_name,
                    'pid': process_info['pid'],
                    'command': process_info['command'],
                    'start_time': process_info['start_time']
                })
            
            # 서버에 현재 상태 전송
            self.sio.emit('current_process_status', {
                'clientName': self.client_name,
                'clientId': self.client_id,
                'running_process_count': len(self.running_processes),
                'running_processes': running_processes,
                'status': 'running' if len(self.running_processes) > 0 else 'online',
                'timestamp': datetime.now().isoformat()
            })
            
            print(f"📊 현재 프로세스 상태 전송: {len(self.running_processes)}개 실행 중")
            logging.info(f"현재 프로세스 상태 전송: {len(self.running_processes)}개 실행 중")
            
        except Exception as e:
            print(f"❌ 프로세스 상태 전송 실패: {e}")
            logging.error(f"프로세스 상태 전송 실패: {e}")
    
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
            while self.running:
                try:
                    heartbeat_count += 1
                    current_time = datetime.now().strftime("%H:%M:%S")
                    
                    print(f"💓 하트비트 전송 시도 #{heartbeat_count}: {self.client_name} (연결 상태: {self.sio.connected}) - {current_time}")
                    logging.info(f"하트비트 전송 시도 #{heartbeat_count}: {self.client_name} (연결 상태: {self.sio.connected})")
                    
                    if self.sio.connected:
                        # Socket.io 연결이 있으면 Socket.io로 하트비트 전송
                        self.sio.emit('heartbeat', {
                            'clientName': self.client_name,
                            'ip_address': self.get_local_ip(),
                            'timestamp': datetime.now().isoformat()
                        })
                        print(f"💓 Socket.io 하트비트 전송 완료: {self.client_name}")
                        logging.info(f"Socket.io 하트비트 전송 완료: {self.client_name}")
                    else:
                        # Socket.io 연결이 없으면 HTTP로 하트비트 전송 및 재등록 시도
                        print(f"⚠️ Socket.io 연결 없음 - HTTP 하트비트 및 재등록 시도")
                        logging.warning("Socket.io 연결 없음 - HTTP 하트비트 및 재등록 시도")
                        
                        # HTTP 하트비트 전송
                        try:
                            response = requests.post(
                                f"{self.server_url}/api/heartbeat",
                                json={
                                    'clientName': self.client_name,
                                    'ip_address': self.get_local_ip(),
                                    'timestamp': datetime.now().isoformat()
                                },
                                timeout=5
                            )
                            
                            if response.status_code == 200:
                                print(f"✅ HTTP 하트비트 전송 성공: {self.client_name}")
                                logging.info(f"HTTP 하트비트 전송 성공: {self.client_name}")
                            else:
                                print(f"⚠️ HTTP 하트비트 전송 실패: {response.status_code}")
                                logging.warning(f"HTTP 하트비트 전송 실패: {response.status_code}")
                                
                                # 하트비트 실패 시 재등록 시도
                                print(f"🔄 하트비트 실패로 인한 재등록 시도")
                                logging.info("하트비트 실패로 인한 재등록 시도")
                                self.register_with_server()
                                
                        except Exception as e:
                            print(f"❌ HTTP 하트비트 전송 오류: {e}")
                            logging.error(f"HTTP 하트비트 전송 오류: {e}")
                            
                            # HTTP 하트비트 실패 시 재등록 시도
                            print(f"🔄 HTTP 하트비트 오류로 인한 재등록 시도")
                            logging.info("HTTP 하트비트 오류로 인한 재등록 시도")
                            self.register_with_server()
                    
                    time.sleep(5)  # 5초마다 하트비트
                    
                except Exception as e:
                    logging.error(f"하트비트 전송 오류: {e}")
                    print(f"❌ 하트비트 전송 오류: {e}")
                    time.sleep(5)  # 오류 발생 시에도 5초 후 재시도
        
        import threading
        heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)
        heartbeat_thread.start()
        print(f"💓 하트비트 스레드 시작 (5초 간격)")
        logging.info(f"하트비트 스레드 시작 (5초 간격)")
    
    def attempt_reconnect(self):
        """서버 재연결을 시도합니다."""
        try:
            print(f"🔄 서버 재연결 시도: {self.client_name}")
            logging.info(f"서버 재연결 시도: {self.client_name}")
            
            # 기존 연결 해제
            if self.sio.connected:
                self.sio.disconnect()
            
            # 잠시 대기
            time.sleep(2)
            
            # 서버에 재등록
            if self.register_with_server():
                print(f"✅ 서버 재등록 성공: {self.client_name}")
                logging.info(f"서버 재등록 성공: {self.client_name}")
                
                # Socket.io 재연결
                if self.connect_socket():
                    print(f"✅ Socket.io 재연결 성공: {self.client_name}")
                    logging.info(f"Socket.io 재연결 성공: {self.client_name}")
                else:
                    print(f"⚠️ Socket.io 재연결 실패: {self.client_name}")
                    logging.warning(f"Socket.io 재연결 실패: {self.client_name}")
            else:
                print(f"❌ 서버 재등록 실패: {self.client_name}")
                logging.error(f"서버 재등록 실패: {self.client_name}")
                
        except Exception as e:
            print(f"❌ 재연결 시도 중 오류: {e}")
            logging.error(f"재연결 시도 중 오류: {e}")
    
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
    
    def on_stop_command(self, data):
        """정지 명령을 받았을 때 호출됩니다."""
        try:
            client_name = data.get('client_name', '')
            preset_id = data.get('preset_id')
            
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
        """전원 관리 명령을 받았을 때 호출됩니다."""
        try:
            action = data.get('action', '')
            client_id = data.get('clientId')
            
            print(f"🔌 전원 명령 수신: {action} - {self.client_name}")
            logging.info(f"전원 명령 수신: {action} - {self.client_name}")
            
            success = False
            error_message = None
            
            if action == 'shutdown':
                success = self.shutdown_system()
            elif action == 'restart':
                success = self.restart_system()
            else:
                error_message = f'지원하지 않는 전원 명령: {action}'
            
            # 결과 전송
            self.sio.emit('power_action_result', {
                'clientName': self.client_name,
                'clientId': client_id,
                'action': action,
                'success': success,
                'error': error_message,
                'timestamp': datetime.now().isoformat()
            })
            
            print(f"✅ 전원 명령 처리 완료: {action} - {'성공' if success else '실패'}")
            
        except Exception as e:
            logging.error(f"전원 명령 처리 중 오류: {e}")
            self.sio.emit('power_action_result', {
                'clientName': self.client_name,
                'clientId': data.get('clientId'),
                'action': data.get('action', ''),
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })
    
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
    parser = argparse.ArgumentParser(description='UE CMS Client')
    parser.add_argument('--server', default='http://localhost:8000', help='서버 URL')
    parser.add_argument('--name', help='클라이언트 이름 (지정하지 않으면 컴퓨터 호스트명 사용)')
    
    args = parser.parse_args()
    
    # 환경 변수에서 서버 URL 가져오기 (우선순위)
    server_url = os.environ.get('UECMS_SERVER_URL', args.server)
    
    try:
        print(f"서버: {server_url}")
        
        client = UECMSClient(
            server_url=server_url,
            client_name=args.name
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