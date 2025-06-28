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
import tkinter as tk
from tkinter import messagebox
import wmi

# pystray를 선택적으로 import
try:
    import pystray
    from PIL import Image, ImageDraw
    PYTRAY_AVAILABLE = True
except ImportError:
    PYTRAY_AVAILABLE = False
    print("⚠️ pystray 모듈을 사용할 수 없습니다. 기본 모드로 실행됩니다.")

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('client_tray.log'),
        logging.StreamHandler()
    ]
)

class SyncChecker:
    """SyncGuard의 핵심 기능을 Python으로 포팅한 클래스"""
    
    class SyncStatus:
        UNKNOWN = "Unknown"
        MASTER = "Master"
        SLAVE = "Slave"
        ERROR = "Error"
    
    def __init__(self):
        self.wmi_connection = None
        self.last_status = self.SyncStatus.UNKNOWN
        
        try:
            self.wmi_connection = wmi.WMI(namespace="root\\CIMV2\\NV")
            logging.info("WMI 연결 성공")
        except Exception as e:
            logging.error(f"WMI 연결 실패: {e}")
            self.wmi_connection = None
    
    def get_sync_status(self):
        """쿼드로 싱크 상태를 확인합니다."""
        if not self.wmi_connection:
            logging.warning("WMI를 사용할 수 없어 싱크 상태 확인을 건너뜁니다.")
            return self.SyncStatus.UNKNOWN
        
        try:
            sync_devices = self.wmi_connection.SyncTopology()
            
            if not sync_devices:
                logging.warning("SyncTopology WMI 클래스에서 Sync 디바이스를 찾을 수 없습니다.")
                return self.SyncStatus.SLAVE
            
            found_master = False
            found_slave = False
            found_error = False
            
            for device in sync_devices:
                try:
                    display_sync_state = int(device.displaySyncState)
                    device_id = int(device.id)
                    is_display_masterable = bool(device.isDisplayMasterable)
                    
                    logging.debug(f"Sync 디바이스: ID={device_id}, State={display_sync_state}, Masterable={is_display_masterable}")
                    
                    # displaySyncState 값으로 동기화 설정 상태 판단
                    # 0 = UnSynced (동기화 설정 안됨) - 빨강
                    # 1 = Slave (슬레이브 모드 - 동기화 설정됨) - 노랑
                    # 2 = Master (마스터 모드 - 동기화 설정됨) - 초록
                    if display_sync_state == 2:
                        logging.info(f"디바이스 {device_id}가 마스터 상태입니다. (State: {display_sync_state})")
                        found_master = True
                    elif display_sync_state == 1:
                        logging.info(f"디바이스 {device_id}가 슬레이브 상태입니다. (State: {display_sync_state})")
                        found_slave = True
                    elif display_sync_state == 0:
                        logging.info(f"디바이스 {device_id}가 동기화되지 않은 상태입니다. (State: {display_sync_state})")
                        found_error = True
                except Exception as ex:
                    logging.error(f"Sync 디바이스 정보 추출 중 오류: {ex}")
            
            # 우선순위: Master > Slave > Error > Unknown
            if found_master:
                logging.info("마스터 디바이스가 발견되어 Master 상태로 설정합니다.")
                return self.SyncStatus.MASTER
            elif found_slave:
                logging.info("슬레이브 디바이스가 발견되어 Slave 상태로 설정합니다.")
                return self.SyncStatus.SLAVE
            elif found_error:
                logging.info("동기화되지 않은 디바이스가 발견되어 Error 상태로 설정합니다.")
                return self.SyncStatus.ERROR
            else:
                logging.warning("Sync 디바이스를 찾을 수 없어 Unknown 상태로 설정합니다.")
                return self.SyncStatus.UNKNOWN
                
        except Exception as ex:
            logging.error(f"Sync 상태 확인 중 오류: {ex}")
            return self.SyncStatus.ERROR
    
    def get_status_text(self, status):
        """상태를 텍스트로 변환합니다."""
        return {
            self.SyncStatus.MASTER: "Synced",
            self.SyncStatus.SLAVE: "Free",
            self.SyncStatus.ERROR: "Free",
            self.SyncStatus.UNKNOWN: "Unknown"
        }.get(status, "Unknown")

class UECMSTrayClient:
    def __init__(self, server_url="http://localhost:8000"):
        self.server_url = server_url
        self.client_name = self.get_computer_name()
        self.client_id = None
        self.sio = socketio.Client()
        self.running = False
        self.current_preset_id = None
        
        # 프로세스 모니터링을 위한 변수들
        self.running_processes = {}
        self.process_monitor_thread = None
        
        # SyncGuard 기능 추가
        self.sync_checker = SyncChecker()
        self.last_sync_status = SyncChecker.SyncStatus.UNKNOWN
        
        # 트레이 아이콘 관련
        self.icon = None
        self.root = None
        
        # 중복 실행 방지를 위한 프로세스 확인
        if not self.check_duplicate_process():
            print(f"❌ 이미 실행 중인 UE CMS 클라이언트가 있습니다. (이름: {self.client_name})")
            logging.error(f"이미 실행 중인 UE CMS 클라이언트가 있습니다. (이름: {self.client_name})")
            sys.exit(1)
        
        # Socket.io 이벤트 핸들러 등록
        self.sio.on('connect', self.on_connect)
        self.sio.on('disconnect', self.on_disconnect)
        self.sio.on('execute_command', self.on_execute_command)
        self.sio.on('connection_check', self.on_connection_check)
        self.sio.on('registration_failed', self.on_registration_failed)
        self.sio.on('stop_command', self.on_stop_command)
        
        logging.info(f"UE CMS 클라이언트 초기화 완료: {self.client_name}")
    
    def check_duplicate_process(self):
        # 강제 실행 옵션 체크
        if os.environ.get('UECMS_FORCE_RUN', '0') == '1':
            print("⚠️ 중복 체크 무시(강제 실행)")
            return True
            
        try:
            import psutil
            # 패키징된 실행 파일인지 확인
            if getattr(sys, 'frozen', False):
                return self.check_duplicate_packaged()
            else:
                return self.check_duplicate_development()
        except ImportError:
            print("⚠️ psutil을 사용할 수 없어 중복 프로세스 확인을 건너뜁니다.")
            return True
        except Exception as e:
            print(f"⚠️ 프로세스 확인 중 오류: {e}")
            return True
    
    def check_duplicate_packaged(self):
        """패키징된 실행 파일용 중복 체크"""
        try:
            import psutil
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
            import psutil
            current_pid = os.getpid()
            current_script = os.path.basename(sys.argv[0]).lower()
            current_proc = psutil.Process(current_pid)
            current_cmdline = current_proc.cmdline() if current_proc.cmdline() else []

            print(f"DEBUG: 개발 환경 - PID={current_pid}, 스크립트={current_script}, cmdline={current_cmdline}")

            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    if proc.info['pid'] == current_pid:
                        continue
                    if proc.info['name'] and 'python' in proc.info['name'].lower():
                        cmdline = proc.info['cmdline']
                        if not cmdline or len(cmdline) < 2:
                            continue
                        proc_script = os.path.basename(cmdline[1]).lower()
                        # 현재 프로세스와 정확히 같은 스크립트를 실행하는지 확인
                        if (proc_script == current_script and proc.is_running()):
                            print(f"⚠️ 같은 스크립트가 이미 실행 중: PID {proc.info['pid']} ({proc_script})")
                            return False
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess, IndexError):
                    continue
            return True
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
    
    def get_sync_status(self):
        """현재 싱크 상태를 가져옵니다."""
        return self.sync_checker.get_sync_status()
    
    def create_icon_image(self, color):
        """아이콘 이미지를 생성합니다."""
        if not PYTRAY_AVAILABLE:
            return None
            
        # 16x16 픽셀 아이콘 생성
        image = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        
        # 원형 아이콘 그리기
        draw.ellipse([2, 2, 14, 14], fill=color, outline=(255, 255, 255, 255))
        
        return image
    
    def create_tray_icon(self):
        """트레이 아이콘을 생성합니다."""
        if not PYTRAY_AVAILABLE:
            print("⚠️ pystray를 사용할 수 없어 트레이 아이콘을 생성할 수 없습니다.")
            return
        
        # 기본 아이콘 이미지 생성 (녹색)
        icon_image = self.create_icon_image('green')
        
        # 메뉴 생성
        menu = pystray.Menu(
            pystray.MenuItem("상태 정보", self.show_status_info),
            pystray.MenuItem("새로고침", self.refresh_status),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("종료", self.stop_client)
        )
        
        # 트레이 아이콘 생성
        self.icon = pystray.Icon(
            "ue_cms_client",
            icon_image,
            "UE CMS Client",
            menu
        )
        
        print("✅ 트레이 아이콘이 생성되었습니다.")
        logging.info("트레이 아이콘이 생성되었습니다.")
    
    def on_icon_click(self, icon, event):
        """트레이 아이콘 클릭 시 호출됩니다."""
        if event.button == 1:  # 왼쪽 클릭
            self.show_status_info()
    
    def show_status_info(self):
        """상태 정보를 보여줍니다."""
        sync_status = self.get_sync_status()
        status_text = self.sync_checker.get_status_text(sync_status)
        
        info = f"""UE CMS Client

클라이언트: {self.client_name}
서버: {self.server_url}
연결 상태: {'연결됨' if self.sio.connected else '연결 안됨'}
싱크 상태: {status_text}
실행 중인 프로세스: {len(self.running_processes)}개"""

        # tkinter 창 생성
        root = tk.Tk()
        root.withdraw()  # 메인 창 숨기기
        messagebox.showinfo("UE CMS Client Status", info)
        root.destroy()
    
    def refresh_status(self):
        """상태를 새로고침합니다."""
        # 싱크 상태 새로고침
        new_sync_status = self.get_sync_status()
        if new_sync_status != self.last_sync_status:
            self.last_sync_status = new_sync_status
            self.update_tray_icon()
            logging.info(f"싱크 상태 변경: {new_sync_status}")
        
        # 서버에 상태 전송
        self.send_current_process_status()
    
    def update_tray_icon(self):
        """트레이 아이콘을 업데이트합니다."""
        if self.icon and PYTRAY_AVAILABLE:
            # 새로운 아이콘 생성
            self.create_tray_icon()
            # 기존 아이콘 교체
            self.icon.icon = self.icon._icon
    
    def register_with_server(self):
        """서버에 클라이언트를 등록합니다."""
        try:
            client_info = {
                'name': self.client_name,
                'ip_address': self.get_local_ip(),
                'port': 8081,
                'sync_status': self.get_sync_status()
            }
            
            response = requests.post(f"{self.server_url}/api/clients", json=client_info, timeout=10)
            
            if response.status_code == 200:
                client_data = response.json()
                self.client_id = client_data['id']
                logging.info(f"서버 등록 성공: ID {self.client_id}")
                return True
            elif response.status_code == 500 and "UNIQUE constraint failed" in response.text:
                logging.info(f"이미 등록된 클라이언트입니다: {self.client_name}. 기존 정보를 조회합니다.")
                try:
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
        
        # 클라이언트 등록
        self.sio.emit('register_client', {
            'name': self.client_name,
            'clientType': 'python_tray',
            'sync_status': self.get_sync_status()
        })
        print(f"📝 클라이언트 등록 요청 전송: {self.client_name}")
        
        # 현재 실행 중인 프로세스 정보를 서버에 전송
        self.send_current_process_status()
        
        self.start_heartbeat()
        self.start_process_monitor()
        self.start_sync_monitor()
    
    def send_current_process_status(self):
        """현재 실행 중인 프로세스 정보를 서버에 전송합니다."""
        try:
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
                'sync_status': self.get_sync_status(),
                'timestamp': datetime.now().isoformat()
            })
            
            print(f"📊 현재 프로세스 상태 전송: {len(self.running_processes)}개 실행 중")
            logging.info(f"현재 프로세스 상태 전송: {len(self.running_processes)}개 실행 중")
            
        except Exception as e:
            print(f"❌ 프로세스 상태 전송 실패: {e}")
            logging.error(f"프로세스 상태 전송 실패: {e}")
    
    def start_sync_monitor(self):
        """싱크 상태 모니터링을 시작합니다."""
        def sync_monitor_loop():
            print(f"🔄 싱크 모니터링 시작: {self.client_name}")
            logging.info(f"싱크 모니터링 시작: {self.client_name}")
            
            while self.running:
                try:
                    current_sync_status = self.get_sync_status()
                    
                    # 상태가 변경된 경우에만 서버에 전송
                    if current_sync_status != self.last_sync_status:
                        self.last_sync_status = current_sync_status
                        
                        # 트레이 아이콘 업데이트
                        self.update_tray_icon()
                        
                        # 서버에 싱크 상태 변경 알림
                        self.sio.emit('sync_status_changed', {
                            'clientName': self.client_name,
                            'clientId': self.client_id,
                            'sync_status': current_sync_status,
                            'status_text': self.sync_checker.get_status_text(current_sync_status),
                            'timestamp': datetime.now().isoformat()
                        })
                        
                        print(f"🔄 싱크 상태 변경: {current_sync_status}")
                        logging.info(f"싱크 상태 변경: {current_sync_status}")
                    
                    time.sleep(10)  # 10초마다 싱크 상태 확인
                    
                except Exception as e:
                    print(f"❌ 싱크 모니터링 오류: {e}")
                    logging.error(f"싱크 모니터링 오류: {e}")
                    time.sleep(10)
            
            print(f"🔄 싱크 모니터링 종료: {self.client_name}")
        
        self.sync_monitor_thread = threading.Thread(target=sync_monitor_loop, daemon=True)
        self.sync_monitor_thread.start()
        print("🔄 싱크 모니터링 스레드 시작 (10초 간격)")
        logging.info("싱크 모니터링 스레드 시작 (10초 간격)")
    
    def on_disconnect(self):
        """Socket.io 연결 해제 시 호출됩니다."""
        print(f"🔌 서버와의 연결이 해제되었습니다: {self.client_name}")
        logging.info("서버와의 연결이 해제되었습니다")
    
    def start_heartbeat(self):
        """하트비트 전송을 시작합니다."""
        def heartbeat_loop():
            heartbeat_count = 0
            print(f"💓 하트비트 루프 시작 - 클라이언트: {self.client_name}")
            logging.info(f"하트비트 루프 시작 - 클라이언트: {self.client_name}")
            
            while self.running:
                try:
                    heartbeat_count += 1
                    print(f"💓 하트비트 전송 시도 #{heartbeat_count}: {self.client_name} (연결 상태: {self.sio.connected}) - {datetime.now().strftime('%H:%M:%S')}")
                    
                    try:
                        print(f"📤 하트비트 전송 중: {self.client_name} -> 서버")
                        
                        running_process_count = len(self.running_processes)
                        status = "콘텐츠 실행 중" if running_process_count > 0 else "실행 중"
                        
                        self.sio.emit('heartbeat', {
                            'name': self.client_name,
                            'status': status,
                            'running_process_count': running_process_count,
                            'running_processes': list(self.running_processes.keys()),
                            'sync_status': self.get_sync_status(),
                            'timestamp': datetime.now().isoformat()
                        })
                        print(f"✅ 하트비트 전송 완료 #{heartbeat_count}: {self.client_name} (연결 상태: {self.sio.connected}) - {datetime.now().strftime('%H:%M:%S')}")
                        logging.info(f"하트비트 전송 #{heartbeat_count}: {self.client_name} (연결 상태: {self.sio.connected})")
                    except Exception as heartbeat_error:
                        print(f"⚠️ 하트비트 전송 실패: {heartbeat_error}")
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
        
        heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)
        heartbeat_thread.start()
        print("💓 하트비트 스레드 시작 (5초 간격)")
        logging.info("하트비트 스레드 시작 (5초 간격)")
    
    def on_registration_failed(self, data):
        """서버 등록 실패 시 호출됩니다."""
        reason = data.get('reason', '알 수 없는 이유')
        logging.error(f"서버 등록 실패: {reason}")
        print(f"❌ 서버 등록 실패: {reason}")
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
                        'status': 'completed',
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
                        'status': 'failed',
                        'timestamp': datetime.now().isoformat()
                    })
            
            # 별도 스레드에서 명령 실행
            execution_thread = threading.Thread(target=execute_command_async, daemon=True)
            execution_thread.start()
            print(f"🚀 명령 실행을 별도 스레드에서 시작: {command}")
            
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
                    'clientName': self.client_name,
                    'sync_status': self.get_sync_status()
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
                logging.info(f"클라이언트 ID 불일치로 정지 요청 무시: {target_client_id} != {self.client_id}")
                return
            
            if target_client_name and target_client_name != self.client_name:
                print(f"❌ 클라이언트 이름 불일치: {target_client_name} != {self.client_name}")
                logging.info(f"클라이언트 이름 불일치로 정지 요청 무시: {target_client_name} != {self.client_name}")
                return
            
            print(f"✅ 정지 요청 대상 확인됨: {self.client_name}")
            
            # 현재 실행 중인 프로세스 정지
            stopped_count = self.stop_running_processes()
            print(f"🛑 {stopped_count}개 프로세스 정지 완료")
            
            # 프리셋 ID 초기화
            self.current_preset_id = None
            
            # 정지 결과를 서버에 전송
            self.sio.emit('stop_result', {
                'clientId': self.client_id,
                'clientName': self.client_name,
                'presetId': preset_id,
                'stopped_count': stopped_count,
                'status': 'completed',
                'timestamp': datetime.now().isoformat()
            })
            
        except Exception as e:
            error_msg = f"정지 요청 처리 중 오류: {e}"
            logging.error(error_msg)
            print(f"❌ {error_msg}")
            
            self.sio.emit('stop_result', {
                'clientId': self.client_id,
                'clientName': self.client_name,
                'presetId': data.get('presetId'),
                'error': error_msg,
                'status': 'failed',
                'timestamp': datetime.now().isoformat()
            })
    
    def add_running_process(self, process_name, pid, command):
        """실행 중인 프로세스를 추가합니다."""
        self.running_processes[process_name] = {
            'pid': pid,
            'command': command,
            'start_time': datetime.now().isoformat()
        }
        print(f"➕ 프로세스 추가: {process_name} (PID: {pid})")
        logging.info(f"프로세스 추가: {process_name} (PID: {pid})")
    
    def remove_running_process(self, process_name):
        """실행 중인 프로세스를 제거합니다."""
        if process_name in self.running_processes:
            del self.running_processes[process_name]
            print(f"➖ 프로세스 제거: {process_name}")
            logging.info(f"프로세스 제거: {process_name}")
    
    def check_process_status(self):
        """현재 실행 중인 프로세스 상태를 확인합니다."""
        try:
            import psutil
            current_processes = {}
            
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    pid = proc.info['pid']
                    name = proc.info['name']
                    cmdline = proc.info['cmdline']
                    
                    if cmdline:
                        command = ' '.join(cmdline)
                        
                        # 실행 중인 프로세스 목록에 있는 프로세스인지 확인
                        for process_name, process_info in self.running_processes.items():
                            if process_info['pid'] == pid:
                                current_processes[process_name] = {
                                    'pid': pid,
                                    'name': name,
                                    'command': command,
                                    'start_time': process_info['start_time']
                                }
                                break
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    continue
            
            # 종료된 프로세스 제거
            for process_name in list(self.running_processes.keys()):
                if process_name not in current_processes:
                    self.remove_running_process(process_name)
            
            return current_processes
            
        except ImportError:
            print("⚠️ psutil을 사용할 수 없어 프로세스 상태 확인을 건너뜁니다.")
            return {}
        except Exception as e:
            logging.error(f"프로세스 상태 확인 중 오류: {e}")
            return {}
    
    def start_process_monitor(self):
        """프로세스 모니터링을 시작합니다."""
        def monitor_loop():
            print(f"📊 프로세스 모니터링 시작: {self.client_name}")
            logging.info(f"프로세스 모니터링 시작: {self.client_name}")
            
            while self.running:
                try:
                    self.check_process_status()
                    time.sleep(5)  # 5초마다 프로세스 상태 확인
                except Exception as e:
                    print(f"❌ 프로세스 모니터링 오류: {e}")
                    logging.error(f"프로세스 모니터링 오류: {e}")
                    time.sleep(5)
            
            print(f"📊 프로세스 모니터링 종료: {self.client_name}")
        
        self.process_monitor_thread = threading.Thread(target=monitor_loop, daemon=True)
        self.process_monitor_thread.start()
        print("📊 프로세스 모니터링 스레드 시작 (5초 간격)")
        logging.info("프로세스 모니터링 스레드 시작 (5초 간격)")
    
    def stop_running_processes(self):
        """현재 실행 중인 모든 프로세스를 정지합니다."""
        try:
            import psutil
            stopped_count = 0
            
            for process_name, process_info in list(self.running_processes.items()):
                try:
                    pid = process_info['pid']
                    proc = psutil.Process(pid)
                    
                    if proc.is_running():
                        print(f"🛑 프로세스 정지 시도: {process_name} (PID: {pid})")
                        proc.terminate()
                        
                        # 3초 대기 후 강제 종료
                        try:
                            proc.wait(timeout=3)
                            print(f"✅ 프로세스 정지 성공: {process_name} (PID: {pid})")
                            stopped_count += 1
                        except psutil.TimeoutExpired:
                            print(f"⚠️ 프로세스 강제 종료: {process_name} (PID: {pid})")
                            proc.kill()
                            stopped_count += 1
                    
                    self.remove_running_process(process_name)
                    
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    print(f"⚠️ 프로세스가 이미 종료됨: {process_name}")
                    self.remove_running_process(process_name)
                    stopped_count += 1
                except Exception as e:
                    print(f"❌ 프로세스 정지 실패: {process_name} - {e}")
                    logging.error(f"프로세스 정지 실패: {process_name} - {e}")
            
            return stopped_count
            
        except ImportError:
            print("⚠️ psutil을 사용할 수 없어 프로세스 정지를 건너뜁니다.")
            return 0
        except Exception as e:
            logging.error(f"프로세스 정지 중 오류: {e}")
            return 0
    
    def execute_command(self, command):
        """명령을 실행합니다."""
        try:
            print(f"🚀 명령 실행: {command}")
            logging.info(f"명령 실행: {command}")
            
            # 명령 실행
            result = self.execute_system_command(command)
            
            # 프로세스 정보 추출 및 추가
            process_name = self.extract_process_name(command)
            if process_name and result.get('pid'):
                self.add_running_process(process_name, result['pid'], command)
            
            return result
            
        except Exception as e:
            error_msg = f"명령 실행 중 오류: {e}"
            logging.error(error_msg)
            print(f"❌ {error_msg}")
            return {'error': error_msg}
    
    def execute_system_command(self, command):
        """시스템 명령을 실행합니다."""
        try:
            # 명령 실행
            process = subprocess.Popen(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # 프로세스 정보 수집
            result = {
                'pid': process.pid,
                'command': command,
                'start_time': datetime.now().isoformat()
            }
            
            print(f"✅ 명령 실행 성공: {command} (PID: {process.pid})")
            logging.info(f"명령 실행 성공: {command} (PID: {process.pid})")
            
            return result
            
        except Exception as e:
            error_msg = f"시스템 명령 실행 중 오류: {e}"
            logging.error(error_msg)
            print(f"❌ {error_msg}")
            return {'error': error_msg}
    
    def extract_process_name(self, command):
        """명령에서 프로세스 이름을 추출합니다."""
        try:
            # 명령에서 실행 파일 이름 추출
            parts = command.split()
            if parts:
                # 경로에서 파일명만 추출
                executable = parts[0]
                if '/' in executable or '\\' in executable:
                    executable = executable.split('/')[-1].split('\\')[-1]
                
                # 확장자 제거
                if '.' in executable:
                    executable = executable.split('.')[0]
                
                return executable
        except Exception as e:
            logging.error(f"프로세스 이름 추출 중 오류: {e}")
        
        return None
    
    def start(self):
        """클라이언트를 시작합니다."""
        try:
            print(f"🚀 클라이언트 시작: {self.client_name}")
            logging.info(f"클라이언트 시작: {self.client_name}")
            
            # 트레이 아이콘 생성 (가능한 경우)
            if PYTRAY_AVAILABLE:
                self.create_tray_icon()
                print("🖥️ 트레이 아이콘이 생성되었습니다. 시스템 트레이를 확인하세요.")
            else:
                print("⚠️ 트레이 아이콘을 사용할 수 없습니다. 콘솔 모드로 실행됩니다.")
            
            # 서버에 등록
            if not self.register_with_server():
                print(f"⚠️ 서버 등록 실패했지만 클라이언트는 계속 실행됩니다.")
            
            # Socket.io 연결
            if not self.connect_socket():
                print(f"⚠️ Socket.io 연결 실패했지만 클라이언트는 계속 실행됩니다.")
            
            # 트레이 아이콘 표시 (가능한 경우)
            if self.icon and PYTRAY_AVAILABLE:
                self.icon.run()
            else:
                # 콘솔 모드로 실행
                print("콘솔 모드로 실행 중... Ctrl+C로 종료하세요.")
                try:
                    while self.running:
                        time.sleep(1)
                except KeyboardInterrupt:
                    print("\n🛑 사용자에 의해 종료됨")
                    self.stop()
            
        except Exception as e:
            print(f"❌ 클라이언트 시작 중 오류: {e}")
            logging.error(f"클라이언트 시작 중 오류: {e}")
            self.stop()
    
    def stop_client(self):
        """클라이언트를 종료합니다."""
        self.stop()
    
    def stop(self):
        """클라이언트를 종료합니다."""
        try:
            print(f"🛑 클라이언트 종료: {self.client_name}")
            logging.info(f"클라이언트 종료: {self.client_name}")
            
            self.running = False
            
            # 실행 중인 프로세스 정지
            self.stop_running_processes()
            
            # Socket.io 연결 해제
            if self.sio.connected:
                self.sio.disconnect()
            
            # 트레이 아이콘 제거
            if self.icon and PYTRAY_AVAILABLE:
                self.icon.stop()
            
            print(f"✅ 클라이언트 종료 완료: {self.client_name}")
            
        except Exception as e:
            print(f"❌ 클라이언트 종료 중 오류: {e}")
            logging.error(f"클라이언트 종료 중 오류: {e}")

def main():
    """메인 함수"""
    print("=" * 50)
    print(" Launching UE CMS Client with Tray Icon")
    print("=" * 50)
    
    # 서버 URL 설정
    server_url = "http://localhost:8000"
    
    print(f"🚀 Starting client with computer name")
    if PYTRAY_AVAILABLE:
        print("To stop the client, right-click the tray icon and select '종료'")
    else:
        print("To stop the client, press Ctrl+C in this window")
    print(f"서버: {server_url}")
    
    try:
        # 클라이언트 생성 및 시작
        client = UECMSTrayClient(server_url)
        client.start()
    except KeyboardInterrupt:
        print("\n🛑 사용자에 의해 종료됨")
    except Exception as e:
        print(f"❌ 클라이언트 실행 중 오류: {e}")
        logging.error(f"클라이언트 실행 중 오류: {e}")
    finally:
        print("✅ 클라이언트 종료")
        print("Client has been stopped.")

if __name__ == "__main__":
    main() 