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
        # 컴퓨터의 실제 호스트명을 사용 (사용자 지정 무시)
        self.client_name = self.get_computer_name()
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
        
        logging.info(f"클라이언트 초기화 완료: {self.client_name}")
    
    def check_duplicate_process(self):
        # 강제 실행 옵션 체크
        if os.environ.get('UECMS_FORCE_RUN', '0') == '1':
            print("⚠️ 중복 체크 무시(강제 실행)")
            return True
            
        if not PSUTIL_AVAILABLE:
            print("⚠️ psutil을 사용할 수 없어 중복 프로세스 확인을 건너뜁니다.")
            return True

        try:
            # 패키징된 실행 파일인지 확인
            if getattr(sys, 'frozen', False):
                return self.check_duplicate_packaged()
            else:
                return self.check_duplicate_development()
        except Exception as e:
            print(f"⚠️ 프로세스 확인 중 오류: {e}")
            return True  # 오류 시 실행 허용
    
    def check_duplicate_packaged(self):
        """패키징된 실행 파일용 중복 체크"""
        try:
            current_pid = os.getpid()
            current_exe = os.path.basename(sys.executable)
            print(f"🔍 패키징된 실행 파일 - PID: {current_pid}, 실행파일: {current_exe}")
            
            duplicate_found = False
            for proc in psutil.process_iter(['pid', 'name']):
                try:
                    if proc.info['pid'] == current_pid:
                        continue
                    if proc.info['name'] == current_exe and proc.is_running():
                        print(f"⚠️ 같은 실행 파일이 이미 실행 중: PID {proc.info['pid']}")
                        duplicate_found = True
                        break
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    continue
            
            if not duplicate_found:
                print("✅ 중복 프로세스가 발견되지 않았습니다.")
            
            return not duplicate_found
        except Exception as e:
            print(f"⚠️ 패키징된 실행 파일 중복 체크 중 오류: {e}")
            return True
    
    def check_duplicate_development(self):
        """개발 환경용 중복 체크"""
        try:
            current_pid = os.getpid()
            current_script = os.path.basename(sys.argv[0]).lower()
            print(f"🔍 개발 환경 - PID: {current_pid}, 스크립트: {current_script}")

            duplicate_found = False
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    if proc.info['pid'] == current_pid:
                        continue
                    if proc.info['name'] and 'python' in proc.info['name'].lower():
                        cmdline = proc.info['cmdline']
                        if cmdline and len(cmdline) > 1:
                            proc_script = os.path.basename(cmdline[1]).lower()
                            if proc_script == current_script and proc.is_running():
                                print(f"⚠️ 같은 스크립트가 이미 실행 중: PID {proc.info['pid']}")
                                duplicate_found = True
                                break
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    continue

            if not duplicate_found:
                print("✅ 중복 프로세스가 발견되지 않았습니다.")

            return not duplicate_found
        except Exception as e:
            print(f"⚠️ 개발 환경 중복 체크 중 오류: {e}")
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
                # 중복 이름인 경우, 기존 클라이언트 정보를 조회하여 ID를 가져옴
                logging.info(f"이미 등록된 클라이언트입니다: {self.client_name}. 기존 정보를 조회합니다.")
                try:
                    # 기존 클라이언트 정보 조회
                    get_response = requests.get(f"{self.server_url}/api/clients", timeout=10)
                    if get_response.status_code == 200:
                        clients = get_response.json()
                        for client in clients:
                            if client['name'] == self.client_name:
                                self.client_id = client['id']
                                logging.info(f"기존 클라이언트 ID 조회 성공: {self.client_id}")
                                return True
                except Exception as e:
                    logging.error(f"기존 클라이언트 정보 조회 실패: {e}")
                
                # 조회 실패해도 연결은 계속 진행
                logging.info(f"기존 클라이언트 정보 조회 실패했지만 연결을 계속합니다.")
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
        
        # 현재 실행 중인 프로세스 정보를 서버에 전송
        self.send_current_process_status()
        
        self.start_heartbeat()
        self.start_process_monitor()  # 프로세스 모니터링 시작
    
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
                        
                        # 클라이언트 상태 정보 수집
                        running_process_count = len(self.running_processes)
                        status = "콘텐츠 실행 중" if running_process_count > 0 else "실행 중"
                        
                        self.sio.emit('heartbeat', {
                            'name': self.client_name,
                            'status': status,
                            'running_process_count': running_process_count,
                            'running_processes': list(self.running_processes.keys()),
                            'timestamp': datetime.now().isoformat()
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
        """서버로부터 정지 요청을 받습니다."""
        try:
            target_client_id = data.get('clientId')
            target_client_name = data.get('clientName')
            preset_id = data.get('presetId')
            
            print(f"🛑 정지 요청 수신: {data}")
            logging.info(f"정지 요청 수신: {data}")
            
            # 클라이언트 ID나 이름으로 대상 확인
            if target_client_id and target_client_id != self.client_id:
                print(f"❌ 클라이언트 ID 불일치: {target_client_id} != {self.client_id}")
                return
            
            if target_client_name and target_client_name != self.client_name:
                print(f"❌ 클라이언트 이름 불일치: {target_client_name} != {self.client_name}")
                return
            
            print(f"✅ 정지 요청 대상 확인됨: {self.client_name}")
            
            # 실행 중인 프로세스 정지
            self.stop_running_processes()
            
            # 프리셋 ID 초기화
            stopped_preset_id = self.current_preset_id
            self.current_preset_id = None
            print(f"📝 프리셋 ID 초기화: {stopped_preset_id} -> None")
            
            # 정지 결과를 서버에 전송
            self.sio.emit('stop_result', {
                'clientId': self.client_id,
                'clientName': self.client_name,
                'presetId': preset_id,
                'stoppedPresetId': stopped_preset_id,
                'result': {'success': True, 'message': '프로세스 정지 완료'},
                'timestamp': datetime.now().isoformat()
            })
            
            print(f"✅ 정지 요청 처리 완료: {self.client_name}")
            
        except Exception as e:
            error_msg = f"정지 요청 처리 중 오류: {e}"
            logging.error(error_msg)
            print(f"❌ {error_msg}")
            
            self.sio.emit('stop_result', {
                'clientId': self.client_id,
                'clientName': self.client_name,
                'presetId': data.get('presetId'),
                'result': {'error': error_msg},
                'timestamp': datetime.now().isoformat()
            })
    
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
    
    args = parser.parse_args()
    
    # 환경 변수에서 서버 URL 가져오기 (우선순위)
    server_url = os.environ.get('UECMS_SERVER_URL', args.server)
    
    try:
        print(f"서버: {server_url}")
        
        client = UECMSClient(
            server_url=server_url
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