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
        self.sio = socketio.Client()
        self.running = False
        self.registration_completed = False  # 등록 완료 상태 추적
        self.running_processes = {}  # 실행 중인 프로세스 추적
        
        # Socket.io 이벤트 핸들러 등록
        self.sio.on('connect', self.on_connect)
        self.sio.on('disconnect', self.on_disconnect)
        self.sio.on('registration_failed', self.on_registration_failed)
        self.sio.on('execute_command', self.on_execute_command)
        self.sio.on('connection_check', self.on_connection_check)
        self.sio.on('stop_command', self.on_stop_command)
        self.sio.on('power_action', self.on_power_action)
        
        logging.info(f"클라이언트 초기화 완료: {self.client_name}")
    
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
        """Socket.io 연결을 설정합니다."""
        try:
            print(f"🔌 소켓 연결 시도: {self.server_url}")
            logging.info(f"소켓 연결 시도: {self.server_url}")
            self.sio.connect(self.server_url)
            self.running = True
            print(f"✅ Socket.io 연결 성공: {self.client_name}")
            logging.info(f"Socket.io 연결 성공: {self.client_name}")
            return True
        except Exception as e:
            print(f"❌ Socket.io 연결 실패: {e}")
            logging.error(f"Socket.io 연결 실패: {e}")
            return False
    
    def on_connect(self):
        print(f"🔌 서버에 연결되었습니다: {self.client_name}")
        logging.info(f"서버에 연결되었습니다: {self.client_name}")
        self.sio.emit('register_client', {
            'name': self.client_name,
            'ip_address': self.get_local_ip(),
            'clientType': 'python'
        })
        print(f"📝 클라이언트 등록 요청 전송: {self.client_name} (IP: {self.get_local_ip()})")
        logging.info(f"클라이언트 등록 요청 전송: {self.client_name} (IP: {self.get_local_ip()})")
        self.start_heartbeat()
    
    def start_heartbeat(self):
        def heartbeat_loop():
            print(f"[하트비트] 루프 시작: {self.client_name}")
            while self.running:
                try:
                    ip = self.get_local_ip()
                    current_time = datetime.now().strftime("%H:%M:%S")
                    print(f"[하트비트] 전송 시작: 이름={self.client_name}, IP={ip}, 시간={current_time}")
                    logging.info(f"[하트비트] 전송 시작: 이름={self.client_name}, IP={ip}, 시간={current_time}")
                    
                    heartbeat_data = {
                        'clientName': self.client_name,
                        'ip_address': ip,
                        'timestamp': datetime.now().isoformat()
                    }
                    print(f"[하트비트] 데이터: {heartbeat_data}")
                    
                    self.sio.emit('heartbeat', heartbeat_data)
                    print(f"[하트비트] 전송 완료: {self.client_name}")
                    
                    time.sleep(5)  # 5초마다 하트비트 전송
                except Exception as e:
                    print(f"[하트비트] 전송 오류: {e}")
                    logging.error(f"[하트비트] 전송 오류: {e}")
                    time.sleep(2)  # 오류 시 2초 후 재시도
        import threading
        heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)
        heartbeat_thread.start()
    
    def on_disconnect(self):
        print(f"🔌 서버와의 연결이 해제되었습니다: {self.client_name}")
        logging.info(f"서버와의 연결이 해제되었습니다: {self.client_name}")
    
    def on_registration_failed(self, data):
        """서버에서 등록 실패 알림을 받았을 때 호출됩니다."""
        try:
            error_message = data.get('message', '등록 실패')
            print(f"❌ 서버 등록 실패: {error_message}")
            logging.error(f"서버 등록 실패: {error_message}")
            self.registration_completed = False
            self.running = False
            self.stop()
        except Exception as e:
            print(f"❌ 서버 등록 실패 처리 중 오류: {e}")
            logging.error(f"서버 등록 실패 처리 중 오류: {e}")
    
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