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
import queue
import psutil
import argparse

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

print("=== client_tray.py 시작 ===")

try:
    class UECMSTrayClient:
        def __init__(self, server_url="http://localhost:8000"):
            # 기본 서버 URL 설정 (start()에서 config 파일 로드)
            self.server_url = server_url
            
            self.client_name = self.get_computer_name()
            self.client_id = None
            self.sio = socketio.Client()
            self.running = False
            self.current_preset_id = None
            
            # 실제 네트워크 IP 캐시
            self.cached_ip = None
            
            # 프로세스 모니터링을 위한 변수들
            self.running_processes = {}
            self.process_monitor_thread = None
            
            # 트레이 아이콘 관련
            self.icon = None
            self.root = None
            
            # 중복 실행 방지를 위한 프로세스 확인
            if not self.check_duplicate_process():
                print(f"❌ 이미 실행 중인 UE CMS 클라이언트가 있습니다. (이름: {self.client_name})")
                logging.error(f"이미 실행 중인 UE CMS 클라이언트가 있습니다. (이름: {self.client_name})")
                sys.exit(1)
            
            # Socket.io 이벤트 핸들러 등록
            print("🔧 Socket.io 이벤트 핸들러 등록 중...")
            self.sio.on('connect', self.on_connect)
            self.sio.on('disconnect', self.on_disconnect)
            self.sio.on('registration_failed', self.on_registration_failed)
            self.sio.on('execute_command', self.on_execute_command)
            self.sio.on('connection_check', self.on_connection_check)
            self.sio.on('stop_command', self.on_stop_command)
            self.sio.on('heartbeat_response', self.on_heartbeat_response)
            self.sio.on('pong', self.on_pong)
            
            # 모든 이벤트를 받기 위한 범용 핸들러 추가
            self.sio.on('*', self.on_any_event)
            print("✅ Socket.io 이벤트 핸들러 등록 완료")
            
            logging.info(f"UE CMS 클라이언트 초기화 완료: {self.client_name}")
            print(f"🔧 서버 설정: {self.server_url}")
            
            self.tk_event_queue = queue.Queue()
        
        def get_computer_name(self):
            """컴퓨터의 실제 호스트명을 가져옵니다."""
            try:
                return socket.gethostname()
            except:
                return f"Client_{os.getpid()}"
        
        def get_local_ip(self):
            """로컬 IP 주소를 가져옵니다."""
            try:
                # 고정 IP 환경을 위한 개선된 IP 탐색
                import socket
                
                # 방법 1: 모든 네트워크 인터페이스에서 실제 IP 찾기
                hostname = socket.gethostname()
                try:
                    # 호스트명으로 IP 조회
                    ip_list = socket.gethostbyname_ex(hostname)[2]
                    
                    # 127.0.0.1이 아닌 실제 IP 찾기
                    for ip in ip_list:
                        if not ip.startswith('127.') and not ip.startswith('169.254.'):
                            print(f"✅ 실제 네트워크 IP 발견: {ip}")
                            logging.info(f"실제 네트워크 IP 발견: {ip}")
                            return ip
                except Exception as e:
                    print(f"⚠️ 호스트명 기반 IP 탐색 실패: {e}")
                    logging.warning(f"호스트명 기반 IP 탐색 실패: {e}")
                
                # 방법 2: 외부 연결 시도 (기존 방법)
                try:
                    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                    s.connect(("8.8.8.8", 80))
                    ip = s.getsockname()[0]
                    s.close()
                    
                    if not ip.startswith('127.'):
                        print(f"✅ 외부 연결 기반 IP 발견: {ip}")
                        logging.info(f"외부 연결 기반 IP 발견: {ip}")
                        return ip
                    else:
                        print(f"⚠️ 외부 연결로 127.x.x.x IP 발견: {ip}")
                        logging.warning(f"외부 연결로 127.x.x.x IP 발견: {ip}")
                except Exception as e:
                    print(f"⚠️ 외부 연결 기반 IP 탐색 실패: {e}")
                    logging.warning(f"외부 연결 기반 IP 탐색 실패: {e}")
                
                # 방법 3: 네트워크 인터페이스 직접 조회 (Windows)
                if os.name == 'nt':
                    try:
                        import subprocess
                        result = subprocess.run(['ipconfig'], capture_output=True, text=True, encoding='cp949')
                        
                        if result.returncode == 0:
                            # IPv4 주소 패턴 매칭
                            import re
                            ip_pattern = r'IPv4 주소[.\s]*:[\s]*([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})'
                            ip_matches = re.findall(ip_pattern, result.stdout)
                            
                            for ip in ip_matches:
                                if not ip.startswith('127.') and not ip.startswith('169.254.'):
                                    print(f"✅ ipconfig 기반 IP 발견: {ip}")
                                    logging.info(f"ipconfig 기반 IP 발견: {ip}")
                                    return ip
                    except Exception as e:
                        print(f"⚠️ ipconfig 기반 IP 탐색 실패: {e}")
                        logging.warning(f"ipconfig 기반 IP 탐색 실패: {e}")
                
                # 모든 방법 실패 시 기본값
                print("❌ 실제 네트워크 IP를 찾을 수 없어 127.0.0.1 사용")
                logging.error("실제 네트워크 IP를 찾을 수 없어 127.0.0.1 사용")
                return "127.0.0.1"
                
            except Exception as e:
                print(f"❌ IP 탐색 중 예외 발생: {e}")
                logging.error(f"IP 탐색 중 예외 발생: {e}")
                return "127.0.0.1"
        
        def cache_network_ip(self):
            """실제 네트워크 IP를 캐시합니다."""
            try:
                actual_ip = self.get_local_ip()
                if actual_ip and not actual_ip.startswith('127.'):
                    self.cached_ip = actual_ip
                    print(f"✅ 네트워크 IP 캐시 완료: {self.cached_ip}")
                    logging.info(f"네트워크 IP 캐시 완료: {self.cached_ip}")
                    return True
                else:
                    print(f"⚠️ 유효한 네트워크 IP를 찾을 수 없어 캐시하지 않음: {actual_ip}")
                    logging.warning(f"유효한 네트워크 IP를 찾을 수 없어 캐시하지 않음: {actual_ip}")
                    return False
            except Exception as e:
                print(f"❌ IP 캐시 중 오류: {e}")
                logging.error(f"IP 캐시 중 오류: {e}")
                return False
        
        def get_cached_ip(self):
            """캐시된 IP를 반환합니다. 없으면 새로 캐시합니다."""
            if self.cached_ip:
                return self.cached_ip
            else:
                self.cache_network_ip()
                return self.cached_ip or "127.0.0.1"
        
        def check_duplicate_process(self):
            """같은 이름의 클라이언트가 이미 실행 중인지 확인합니다."""
            # 일시적으로 중복 검사 비활성화
            print("⚠️ 중복 프로세스 검사 비활성화됨 (tray)")
            return True
            
            # 기존 검사 로직 (주석 처리)
            """
            try:
                current_pid = os.getpid()
                current_script = os.path.abspath(sys.argv[0])
                
                for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                    try:
                        # 현재 프로세스는 제외
                        if proc.info['pid'] == current_pid:
                            continue
                        
                        # Python 프로세스인지 확인
                        if proc.info['name'] and 'python' in proc.info['name'].lower():
                            cmdline = proc.info['cmdline']
                            if cmdline and len(cmdline) > 1:
                                # client_tray.py가 실행 중인지 확인
                                if 'client_tray.py' in cmdline[1] or 'start_client.bat' in ' '.join(cmdline):
                                    print(f"⚠️ 다른 클라이언트 프로세스 발견: PID {proc.info['pid']}")
                                    return False
                    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                        continue
                return True
            except Exception as e:
                print(f"⚠️ 프로세스 확인 중 오류: {e}")
                return True  # 오류 시 실행 허용
            """
        
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
                print("⚠️ pystray를 사용할 수 없어 트레이 아이콘을 생성하지 않습니다.")
                return
            
            try:
                # 초기 상태는 연결 안됨으로 설정 (빨간색)
                initial_color = (255, 0, 0, 255)  # 빨간색
                image = self.create_icon_image(initial_color)
                
                # 메뉴 아이템 생성
                menu = pystray.Menu(
                    pystray.MenuItem("상태 정보", self.safe_show_status_info),
                    pystray.MenuItem("새로고침", self.safe_refresh_status),
                    pystray.MenuItem("설정", self.safe_open_config),
                    pystray.MenuItem("서버 재연결", self.safe_reconnect_to_server),
                    pystray.MenuItem("종료", self.safe_stop_client)
                )
                
                # 트레이 아이콘 생성
                self.icon = pystray.Icon("ue_cms_client", image, "UE CMS Client", menu)
                
                # 아이콘 클릭 이벤트 설정
                self.icon.on_click = self.on_icon_click
                
                print("✅ 트레이 아이콘 생성 완료")
                logging.info("트레이 아이콘 생성 완료")
                
            except Exception as e:
                print(f"❌ 트레이 아이콘 생성 실패: {e}")
                logging.error(f"트레이 아이콘 생성 실패: {e}")
                self.icon = None
        
        def safe_show_status_info(self, icon, item):
            """안전한 상태 정보 표시"""
            try:
                print("📊 상태 정보 메뉴 클릭됨")
                self.show_status_info()
            except Exception as e:
                print(f"❌ 상태 정보 표시 오류: {e}")
        
        def safe_refresh_status(self, icon, item):
            """안전한 상태 새로고침"""
            try:
                print("🔄 새로고침 메뉴 클릭됨")
                self.refresh_status()
            except Exception as e:
                print(f"❌ 상태 새로고침 오류: {e}")
        
        def safe_open_config(self, icon, item):
            """안전한 설정 파일 열기"""
            try:
                print("🔧 설정 파일 열기 메뉴 클릭됨")
                import os
                import subprocess
                
                # 실행 파일과 같은 디렉토리의 config.json 파일 사용
                if getattr(sys, 'frozen', False):
                    # PyInstaller로 패키징된 경우
                    config_file = os.path.join(os.path.dirname(sys.executable), "config.json")
                else:
                    # 개발 환경
                    config_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
                
                if os.path.exists(config_file):
                    # Windows에서 메모장으로 파일 열기
                    subprocess.Popen(["notepad.exe", config_file])
                    print(f"✅ 설정 파일 열기: {config_file}")
                else:
                    # 설정 파일이 없으면 새로 생성
                    default_config = {
                        "server_url": "http://localhost:8000"
                    }
                    import json
                    with open(config_file, 'w', encoding='utf-8') as f:
                        json.dump(default_config, f, indent=2, ensure_ascii=False)
                    
                    # 생성된 파일 열기
                    subprocess.Popen(["notepad.exe", config_file])
                    print(f"✅ 새 설정 파일 생성 및 열기: {config_file}")
                    
            except Exception as e:
                print(f"❌ 설정 파일 열기 오류: {e}")
                import traceback
                traceback.print_exc()
        
        def safe_reconnect_to_server(self, icon, item):
            """안전한 서버 재연결"""
            try:
                print("🔄 서버 재연결 메뉴 클릭됨")
                self.reconnect_to_server(icon, item)
            except Exception as e:
                print(f"❌ 서버 재연결 오류: {e}")
        
        def safe_stop_client(self, icon, item):
            """안전한 클라이언트 종료"""
            try:
                print("🛑 종료 메뉴 클릭됨")
                self.stop_client()
            except Exception as e:
                print(f"❌ 클라이언트 종료 오류: {e}")
        
        def run_tray_icon(self):
            """트레이 아이콘을 실행합니다."""
            if self.icon and PYTRAY_AVAILABLE:
                try:
                    print("🖥️ 트레이 아이콘 실행 중...")
                    logging.info("트레이 아이콘 실행 중...")
                    # 트레이 아이콘 실행 (블로킹)
                    self.icon.run()
                except Exception as e:
                    print(f"❌ 트레이 아이콘 실행 실패: {e}")
                    logging.error(f"트레이 아이콘 실행 실패: {e}")
            else:
                print("⚠️ 트레이 아이콘을 실행할 수 없습니다. (pystray 미설치 또는 아이콘 생성 실패)")
                logging.warning("트레이 아이콘을 실행할 수 없습니다.")
        
        def on_icon_click(self, icon, event):
            """트레이 아이콘 클릭 시 호출됩니다."""
            if event.button == 1:  # 왼쪽 클릭
                self.show_status_info()
        
        def show_status_info(self):
            """상태 정보를 보여줍니다."""
            info = f"""UE CMS Client

클라이언트: {self.client_name}
서버: {self.server_url}
연결 상태: {'연결됨' if self.sio.connected else '연결 안됨'}
실행 중인 프로세스: {len(self.running_processes)}개"""

            # tkinter 창 생성
            root = tk.Tk()
            root.withdraw()  # 메인 창 숨기기
            messagebox.showinfo("UE CMS Client Status", info)
            root.destroy()
        
        def refresh_status(self):
            """상태를 새로고침합니다."""
            # 서버에 상태 전송
            self.send_current_process_status()
        
        def update_tray_icon(self):
            """트레이 아이콘을 업데이트합니다."""
            if self.icon and PYTRAY_AVAILABLE:
                try:
                    # 연결 상태 확인 (더 정확한 방법)
                    is_connected = False
                    if hasattr(self, 'sio') and self.sio:
                        is_connected = self.sio.connected
                    
                    print(f"🔍 [트레이 아이콘] 연결 상태 확인: sio.connected = {is_connected}")
                    print(f"🔍 [트레이 아이콘] 클라이언트 이름: {self.client_name}")
                    
                    # 연결 상태에 따른 아이콘 색상 결정
                    if is_connected:
                        icon_color = (0, 255, 0, 255)  # 녹색 (연결됨)
                        print("🟢 [트레이 아이콘] 업데이트: 연결됨 (녹색)")
                    else:
                        icon_color = (255, 0, 0, 255)  # 빨간색 (연결 안됨)
                        print("🔴 [트레이 아이콘] 업데이트: 연결 안됨 (빨간색)")
                    
                    # 새로운 아이콘 이미지 생성
                    new_image = self.create_icon_image(icon_color)
                    
                    # 기존 아이콘 교체 (강제 업데이트)
                    self.icon.icon = new_image
                    
                    # 트레이 아이콘 새로고침 (Windows에서 필요)
                    try:
                        self.icon.update_menu()
                    except:
                        pass
                    
                    print("✅ [트레이 아이콘] 색상 업데이트 완료")
                    print(f"🎨 [트레이 아이콘] 실제 색상: {icon_color}")
                    
                    # 추가 디버깅: 아이콘 객체 상태 확인
                    print(f"🔍 [트레이 아이콘] 아이콘 객체: {self.icon}")
                    print(f"🔍 [트레이 아이콘] 이미지 객체: {new_image}")
                    
                except Exception as e:
                    print(f"❌ [트레이 아이콘] 업데이트 실패: {e}")
                    logging.error(f"트레이 아이콘 업데이트 실패: {e}")
                    import traceback
                    traceback.print_exc()
        
        def register_with_server(self):
            """
            서버에 클라이언트를 등록합니다.
            """
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
                    return True
                else:
                    return False
            except Exception as e:
                return False

        def connect_socket(self):
            """
            Socket.io 연결을 설정합니다.
            """
            try:
                print(f"🔌 Socket.io 연결 시도: {self.server_url}")
                logging.info(f"Socket.io 연결 시도: {self.server_url}")
                
                # Python Socket.IO 클라이언트에 맞는 옵션 설정
                # reconnection 관련 옵션 제거 (지원되지 않음)
                self.sio.connect(
                    self.server_url,
                    transports=['websocket', 'polling'],
                    wait_timeout=10
                )
                
                self.running = True
                print(f"✅ Socket.io 연결 설정 완료")
                logging.info("Socket.io 연결 설정 완료")
                return True
            except Exception as e:
                print(f"❌ Socket.io 연결 실패: {e}")
                logging.error(f"Socket.io 연결 실패: {e}")
                return False

        def on_connect(self):
            """Socket.io 연결 시 호출됩니다."""
            print(f"🔌 서버에 연결되었습니다: {self.client_name}")
            logging.info("서버에 연결되었습니다")
            
            # 연결 성공 시 즉시 트레이 아이콘 업데이트
            if hasattr(self, 'update_tray_icon'):
                self.update_tray_icon()
            
            # 클라이언트 등록 (지연 후 실행)
            def register_after_delay():
                try:
                    time.sleep(2)  # 2초 대기 (서버 준비 시간)
                    
                    if self.sio.connected:
                        registration_data = {
                            'name': self.client_name,
                            'clientType': 'python',
                            'ip_address': self.get_cached_ip()
                        }
                        print(f"📝 클라이언트 등록 요청 준비: {self.client_name}")
                        print(f"📝 등록 데이터: {registration_data}")
                        
                        self.sio.emit('register_client', registration_data)
                        print(f"📝 클라이언트 등록 요청 전송 완료: {self.client_name}")
                        logging.info(f"클라이언트 등록 요청 전송: {self.client_name}")
                    else:
                        print(f"⚠️ 소켓이 연결되지 않아 등록 요청을 보낼 수 없음")
                        logging.warning("소켓이 연결되지 않아 등록 요청을 보낼 수 없음")
                except Exception as e:
                    print(f"❌ 클라이언트 등록 요청 실패: {e}")
                    logging.error(f"클라이언트 등록 요청 실패: {e}")
                    import traceback
                    traceback.print_exc()
            
            # 별도 스레드에서 등록 요청 전송
            import threading
            register_thread = threading.Thread(target=register_after_delay, daemon=True)
            register_thread.start()
            
            # 하트비트는 등록 성공 후에 시작 (타이밍 문제 해결)
            # self.start_heartbeat()  # 즉시 시작하지 않음
        
        def send_current_process_status(self):
            """현재 실행 중인 프로세스 상태를 서버에 전송합니다."""
            try:
                if self.sio.connected:
                    self.sio.emit('process_status', {
                        'clientName': self.client_name,
                        'processes': list(self.running_processes.keys()),
                        'timestamp': datetime.now().isoformat()
                    })
            except Exception as e:
                logging.error(f"프로세스 상태 전송 실패: {e}")
        
        def on_disconnect(self):
            """Socket.io 연결 해제 시 호출됩니다."""
            print(f"🔌 서버와의 연결이 해제되었습니다: {self.client_name}")
            logging.info("서버와의 연결이 해제되었습니다")
            
            # 연결 해제 시에도 클라이언트는 계속 실행 (독립성 확보)
            # self.running = False  # 클라이언트 종료 방지
            
            # 트레이 아이콘 색상 업데이트 (빨간색으로 변경)
            self.update_tray_icon()
            
            # 자동 재연결 시도
            print(f"🔄 서버 재연결 시도 중: {self.client_name}")
            logging.info(f"서버 재연결 시도 중: {self.client_name}")
            
            # 5초 후 재연결 시도
            def reconnect_after_delay():
                time.sleep(5)
                if not self.sio.connected:
                    print(f"🔄 재연결 시도: {self.client_name}")
                    logging.info(f"재연결 시도: {self.client_name}")
                    self.connect_socket()
            
            import threading
            reconnect_thread = threading.Thread(target=reconnect_after_delay, daemon=True)
            reconnect_thread.start()
        
        def start_heartbeat(self):
            """하트비트 전송을 시작합니다."""
            print(f"💓 하트비트 시작: {self.client_name}")
            logging.info(f"하트비트 시작: {self.client_name}")
            
            def heartbeat_loop():
                print(f"💓 하트비트 루프 시작: {self.client_name}")
                logging.info(f"하트비트 루프 시작: {self.client_name}")
                
                # 첫 번째 하트비트 전송 전에 3초 대기 (서버 준비 시간)
                print(f"⏳ 첫 번째 하트비트 전송 전 3초 대기...")
                time.sleep(3)
                
                while self.running:
                    try:
                        # 연결 상태 확인
                        if not self.sio.connected:
                            print(f"⚠️ 하트비트 전송 건너뜀: 소켓이 연결되지 않음")
                            logging.warning("하트비트 전송 건너뜀: 소켓이 연결되지 않음")
                            time.sleep(5)
                            continue
                        
                        # 하트비트 전송 (서버 오류 수정 후 복원)
                        heartbeat_data = {
                            'clientName': self.client_name,
                            'ip_address': self.get_cached_ip(),
                            'timestamp': datetime.now().isoformat()
                        }
                        self.sio.emit('heartbeat', heartbeat_data)
                        print(f"💓 하트비트 전송: {self.client_name}")
                        logging.info(f"하트비트 전송: {self.client_name}")
                        time.sleep(5)  # 5초마다 하트비트
                    except Exception as e:
                        logging.error(f"하트비트 전송 오류: {e}")
                        # 연결 오류 시에도 클라이언트는 계속 실행
                        if "not a connected namespace" in str(e):
                            print(f"⚠️ 하트비트 전송 실패 - 연결 상태 확인 후 재시도")
                            logging.warning("하트비트 전송 실패 - 연결 상태 확인 후 재시도")
                        time.sleep(5)  # 오류 시 5초 후 재시도
            
            import threading
            heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)
            heartbeat_thread.start()
        
        def on_registration_failed(self, data):
            """클라이언트 등록 실패 시 호출됩니다."""
            reason = data.get('reason', '알 수 없는 이유')
            print(f"❌ 클라이언트 등록 실패: {reason}")
            logging.error(f"클라이언트 등록 실패: {reason}")
        
        def on_execute_command(self, data):
            """명령 실행 요청을 받았을 때 호출됩니다."""
            try:
                command = data.get('command', '')
                preset_id = data.get('preset_id')
                # 두 가지 필드명 모두 처리
                client_name = data.get('client_name', '') or data.get('clientName', '')
                
                if client_name != self.client_name:
                    return  # 다른 클라이언트용 명령이면 무시
                
                print(f"📋 명령 실행 요청: {command}")
                logging.info(f"명령 실행 요청: {command}")
                
                # 명령 실행을 별도 스레드에서 처리
                def execute_command_async():
                    try:
                        result = self.execute_command(command)
                        
                        # 결과 전송
                        self.sio.emit('execution_result', {
                            'clientName': self.client_name,
                            'presetId': preset_id,
                            'command': command,
                            'result': result,
                            'timestamp': datetime.now().isoformat()
                        })
                        
                        print(f"✅ 명령 실행 완료: {result.get('success', False)}")
                        
                    except Exception as e:
                        logging.error(f"명령 실행 중 오류: {e}")
                        self.sio.emit('execution_result', {
                            'clientName': self.client_name,
                            'presetId': preset_id,
                            'command': command,
                            'result': {'success': False, 'error': str(e)},
                            'timestamp': datetime.now().isoformat()
                        })
                
                # 별도 스레드에서 명령 실행
                command_thread = threading.Thread(target=execute_command_async, daemon=True)
                command_thread.start()
                
            except Exception as e:
                logging.error(f"명령 실행 요청 처리 중 오류: {e}")
        
        def on_connection_check(self, data):
            """연결 확인 요청을 받았을 때 호출됩니다."""
            try:
                # 두 가지 필드명 모두 처리 (서버에서 일관성 없이 보내는 경우 대비)
                client_name = data.get('client_name', '') or data.get('clientName', '')
                timestamp = data.get('timestamp', '')
                
                logging.info(f"연결 확인 요청 수신: {self.client_name}")
                
                # 빈 문자열이거나 현재 클라이언트 이름과 다른 경우 처리
                if not client_name:
                    client_name = self.client_name  # 빈 문자열이면 현재 클라이언트로 처리
                elif client_name != self.client_name:
                    return  # 다른 클라이언트용 요청이면 무시
                
                # 연결 확인 응답
                if self.sio.connected:
                    response_data = {
                        'clientName': self.client_name,
                        'status': 'online',
                        'timestamp': datetime.now().isoformat()
                    }
                    
                    self.sio.emit('connection_check_response', response_data)
                    logging.info(f"연결 확인 응답 전송: {self.client_name}")
                else:
                    logging.warning(f"소켓이 연결되지 않음 - 연결 확인 응답 건너뜀: {self.client_name}")
                
            except Exception as e:
                print(f"❌ [연결 확인] 응답 중 오류: {e}")
                logging.error(f"연결 확인 응답 중 오류: {e}")
                import traceback
                traceback.print_exc()
        
        def on_stop_command(self, data):
            """정지 명령을 받았을 때 호출됩니다."""
            try:
                # 두 가지 필드명 모두 처리
                client_name = data.get('client_name', '') or data.get('clientName', '')
                
                if client_name != self.client_name:
                    return  # 다른 클라이언트용 명령이면 무시
                
                print(f"🛑 정지 명령 수신: {self.client_name}")
                logging.info(f"정지 명령 수신: {self.client_name}")
                
                # 실행 중인 모든 프로세스 정지
                self.stop_running_processes()
                
                # 정지 완료 응답 전송
                if self.sio.connected:
                    self.sio.emit('stop_command_completed', {
                        'clientName': self.client_name,
                        'timestamp': datetime.now().isoformat()
                    })
                    
                    print(f"✅ 정지 완료 응답 전송: {self.client_name}")
                
            except Exception as e:
                logging.error(f"정지 명령 처리 중 오류: {e}")
        
        def add_running_process(self, process_name, pid, command):
            """실행 중인 프로세스를 추가합니다."""
            self.running_processes[process_name] = {
                'pid': pid,
                'command': command,
                'start_time': datetime.now()
            }
            logging.info(f"프로세스 추가: {process_name} (PID: {pid})")
        
        def remove_running_process(self, process_name):
            """실행 중인 프로세스를 제거합니다."""
            if process_name in self.running_processes:
                del self.running_processes[process_name]
                logging.info(f"프로세스 제거: {process_name}")
        
        def check_process_status(self):
            """실행 중인 프로세스 상태를 확인합니다."""
            processes_to_remove = []
            
            for process_name, process_info in self.running_processes.items():
                try:
                    pid = process_info['pid']
                    proc = psutil.Process(pid)
                    
                    if not proc.is_running():
                        processes_to_remove.append(process_name)
                        logging.info(f"프로세스 종료 감지: {process_name} (PID: {pid})")
                    
                except psutil.NoSuchProcess:
                    processes_to_remove.append(process_name)
                    logging.info(f"프로세스 존재하지 않음: {process_name} (PID: {pid})")
                except Exception as e:
                    logging.error(f"프로세스 상태 확인 중 오류: {e}")
            
            # 종료된 프로세스 제거
            for process_name in processes_to_remove:
                self.remove_running_process(process_name)
        
        def start_process_monitor(self):
            """프로세스 모니터링을 시작합니다."""
            def monitor_loop():
                while self.running:
                    try:
                        self.check_process_status()
                        time.sleep(10)  # 10초마다 체크
                    except Exception as e:
                        logging.error(f"프로세스 모니터링 중 오류: {e}")
                        time.sleep(5)
            
            self.process_monitor_thread = threading.Thread(target=monitor_loop, daemon=True)
            self.process_monitor_thread.start()
        
        def stop_running_processes(self):
            """실행 중인 모든 프로세스를 정지합니다."""
            print(f"🛑 실행 중인 프로세스 정지 중... ({len(self.running_processes)}개)")
            
            for process_name, process_info in self.running_processes.items():
                try:
                    pid = process_info['pid']
                    proc = psutil.Process(pid)
                    
                    if proc.is_running():
                        # 프로세스 종료
                        proc.terminate()
                        
                        # 5초 대기 후 강제 종료
                        try:
                            proc.wait(timeout=5)
                            print(f"✅ 프로세스 정지 완료: {process_name} (PID: {pid})")
                        except psutil.TimeoutExpired:
                            proc.kill()
                            print(f"⚠️ 프로세스 강제 종료: {process_name} (PID: {pid})")
                    
                except psutil.NoSuchProcess:
                    print(f"⚠️ 프로세스가 이미 종료됨: {process_name} (PID: {pid})")
                except Exception as e:
                    print(f"❌ 프로세스 정지 중 오류: {process_name} - {e}")
            
            # 프로세스 목록 초기화
            self.running_processes.clear()
            print("✅ 모든 프로세스 정지 완료")
        
        def execute_command(self, command):
            """명령을 실행합니다."""
            try:
                logging.info(f"명령 실행: {command}")
                
                # 시스템 명령 실행
                process = subprocess.Popen(
                    command,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                
                stdout, stderr = process.communicate(timeout=30)
                
                # 실행된 프로세스 정보 저장
                process_name = self.extract_process_name(command)
                if process_name:
                    self.add_running_process(process_name, process.pid, command)
                
                return {
                    'success': process.returncode == 0,
                    'stdout': stdout,
                    'stderr': stderr,
                    'returncode': process.returncode,
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
                logging.error(f"명령 실행 실패: {e}")
                return {
                    'success': False,
                    'error': str(e),
                    'timestamp': datetime.now().isoformat()
                }
        
        def execute_system_command(self, command):
            """시스템 명령을 실행합니다."""
            try:
                logging.info(f"시스템 명령 실행: {command}")
                
                # 시스템 명령 실행
                process = subprocess.Popen(
                    command,
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
                    'returncode': process.returncode,
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
                logging.error(f"시스템 명령 실행 실패: {e}")
                return {
                    'success': False,
                    'error': str(e),
                    'timestamp': datetime.now().isoformat()
                }
        
        def extract_process_name(self, command):
            """명령에서 프로세스 이름을 추출합니다."""
            try:
                # 명령의 첫 번째 부분을 프로세스 이름으로 사용
                parts = command.strip().split()
                if parts:
                    # 경로에서 파일명만 추출
                    process_name = os.path.basename(parts[0])
                    return process_name
                return None
            except Exception as e:
                logging.error(f"프로세스 이름 추출 실패: {e}")
                return None
        
        def on_any_event(self, event, data):
            """모든 소켓 이벤트를 받아서 로그로 출력합니다."""
            print(f"📡 [소켓 이벤트] 수신: {event} - 데이터: {data}")
            logging.info(f"소켓 이벤트 수신: {event} - 데이터: {data}")
            
            # connection_check 이벤트를 특별히 처리
            if event == 'connection_check':
                print(f"🔍 [소켓 이벤트] connection_check 이벤트 감지!")
                self.on_connection_check(data)
            
            # registration_success 이벤트 처리 (등록 성공 후 하트비트 시작)
            elif event == 'registration_success':
                print(f"✅ [소켓 이벤트] 클라이언트 등록 성공! 하트비트 시작")
                logging.info("클라이언트 등록 성공 - 하트비트 시작")
                self.start_heartbeat()
        
        def on_heartbeat_response(self, data):
            """하트비트 응답을 받았을 때 호출됩니다."""
            try:
                # 서버에서 보내는 필드명에 맞춰 수정
                success = data.get('success', False)
                message = data.get('message', '')
                timestamp = data.get('timestamp', '')
                
                print(f"💚 [하트비트 응답] 수신: success={success} - {message} (시간: {timestamp})")
                logging.info(f"하트비트 응답 수신: success={success} - {message}")
                
                # 하트비트 응답을 받으면 연결이 정상임을 확인하고 트레이 아이콘을 녹색으로 업데이트
                if success:
                    print(f"🟢 [하트비트 응답] 연결 상태 확인됨 - 트레이 아이콘 녹색으로 업데이트")
                    self.update_tray_icon()
                else:
                    print(f"🔴 [하트비트 응답] 연결 상태 오류: {message}")
                
            except Exception as e:
                print(f"❌ [하트비트 응답] 처리 중 오류: {e}")
                logging.error(f"하트비트 응답 처리 중 오류: {e}")
        
        def on_pong(self, data):
            """pong 응답을 받았을 때 호출됩니다."""
            try:
                timestamp = data.get('timestamp', '')
                print(f"🏓 [pong] 서버 응답 수신: {timestamp}")
                logging.info(f"pong 응답 수신: {timestamp}")
            except Exception as e:
                logging.error(f"pong 응답 처리 중 오류: {e}")
        
        def start(self):
            """
            클라이언트를 시작합니다.
            """
            try:
                print("=========================================")
                print(" Launching Switchboard Plus v2.0 Client")
                print("=========================================")
                print(f"🚀 Starting client with computer name: {self.client_name}")
                print("To stop the client, press Ctrl+C in this window.")
                print(f"서버: {self.server_url}")
                
                # 트레이 아이콘 생성
                self.create_tray_icon()
                
                # 트레이 아이콘을 별도 스레드에서 실행
                if self.icon and PYTRAY_AVAILABLE:
                    import threading
                    tray_thread = threading.Thread(target=self.run_tray_icon, daemon=True)
                    tray_thread.start()
                    print("✅ 트레이 아이콘 스레드 시작")
                    
                    # 초기 트레이 아이콘 업데이트 (빨간색으로 시작)
                    self.update_tray_icon()
                
                # 프로세스 모니터링 시작
                self.start_process_monitor()
                
                # Socket.io 연결
                if self.connect_socket():
                    print("✅ Socket.io 연결 성공")
                    logging.info("Socket.io 연결 성공")
                    
                    # 하트비트 시작
                    self.start_heartbeat()
                    print("💓 하트비트 서비스 시작됨")
                    
                    # 연결 성공 시 트레이 아이콘 업데이트 (녹색으로 변경)
                    self.update_tray_icon()
                else:
                    print("⚠️ Socket.io 연결 실패")
                    logging.warning("Socket.io 연결 실패")
                    # 연결 실패 시 트레이 아이콘 업데이트 (빨간색 유지)
                    self.update_tray_icon()
                
                # 메인 루프
                while self.running:
                    try:
                        # 트레이 아이콘 이벤트 처리
                        if hasattr(self, 'icon') and self.icon:
                            self.process_tk_events()
                        
                        time.sleep(1)
                    except KeyboardInterrupt:
                        print("\n🛑 사용자에 의해 종료됨")
                        break
                    except Exception as e:
                        logging.error(f"메인 루프 오류: {e}")
                        time.sleep(5)
                
            except KeyboardInterrupt:
                print("\n🛑 사용자에 의해 종료됨")
            except Exception as e:
                logging.error(f"클라이언트 실행 중 오류: {e}")
                print(f"❌ 클라이언트 실행 중 오류: {e}")
            finally:
                self.stop()
        
        def stop_client(self):
            """클라이언트를 중지합니다."""
            self.stop()
        
        def stop(self):
            """클라이언트를 중지합니다."""
            print(f"🛑 클라이언트 종료 중: {self.client_name}")
            self.running = False
            
            # 현재 서버 설정 저장
            try:
                self.save_server_config(self.server_url)
                print(f"✅ 서버 설정 저장됨: {self.server_url}")
            except Exception as e:
                print(f"⚠️ 서버 설정 저장 실패: {e}")
            
            # 실행 중인 프로세스 정지
            self.stop_running_processes()
            
            # 트레이 아이콘 제거
            if self.icon and PYTRAY_AVAILABLE:
                try:
                    self.icon.stop()
                except Exception as e:
                    print(f"⚠️ 트레이 아이콘 제거 중 오류: {e}")
            
            try:
                if self.sio.connected:
                    self.sio.disconnect()
            except Exception as e:
                print(f"⚠️ 소켓 연결 해제 중 오류: {e}")
            
            logging.info("클라이언트 종료")
            print(f"✅ 클라이언트 종료 완료: {self.client_name}")
        
        def load_server_config(self):
            """저장된 서버 설정을 로드합니다."""
            try:
                # 실행 파일과 같은 디렉토리의 config.json 파일 사용
                if getattr(sys, 'frozen', False):
                    # PyInstaller로 패키징된 경우
                    config_file = os.path.join(os.path.dirname(sys.executable), "config.json")
                else:
                    # 개발 환경
                    config_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
                
                if os.path.exists(config_file):
                    with open(config_file, 'r', encoding='utf-8') as f:
                        config = json.load(f)
                        self.server_url = config.get('server_url', "http://localhost:8000")
                        print(f"✅ 서버 설정 로드됨: {self.server_url}")
                        logging.info(f"서버 설정 로드됨: {self.server_url}")
                        return True
                else:
                    print("ℹ️ 저장된 서버 설정이 없습니다. 기본값 사용: http://localhost:8000")
                    logging.info("저장된 서버 설정이 없습니다. 기본값 사용")
                    return False
            except Exception as e:
                print(f"❌ 서버 설정 로드 실패: {e}")
                logging.error(f"서버 설정 로드 실패: {e}")
                return False
        
        def save_server_config(self, server_url):
            """서버 설정을 저장합니다."""
            try:
                # 실행 파일과 같은 디렉토리의 config.json 파일 사용
                if getattr(sys, 'frozen', False):
                    # PyInstaller로 패키징된 경우
                    config_file = os.path.join(os.path.dirname(sys.executable), "config.json")
                else:
                    # 개발 환경
                    config_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
                
                config = {
                    'server_url': server_url,
                    'saved_at': datetime.now().isoformat()
                }
                with open(config_file, 'w', encoding='utf-8') as f:
                    json.dump(config, f, ensure_ascii=False, indent=2)
                print(f"✅ 서버 설정 저장됨: {server_url}")
                logging.info(f"서버 설정 저장됨: {server_url}")
                return True
            except Exception as e:
                print(f"❌ 서버 설정 저장 실패: {e}")
                logging.error(f"서버 설정 저장 실패: {e}")
                return False
        
        def reconnect_to_server(self, icon=None, item=None):
            """서버에 재연결을 시도합니다."""
            try:
                print(f"🔄 서버 재연결 시도: {self.server_url}")
                logging.info(f"서버 재연결 시도: {self.server_url}")
                
                # 기존 연결 해제
                if self.sio.connected:
                    self.sio.disconnect()
                
                # 잠시 대기 후 재연결
                time.sleep(1)
                
                # 새 연결 시도
                if self.connect_socket():
                    print("✅ 서버 재연결 성공")
                    logging.info("서버 재연결 성공")
                    # 트레이 아이콘 색상 업데이트 (녹색으로 변경)
                    self.update_tray_icon()
                else:
                    print("❌ 서버 재연결 실패")
                    logging.error("서버 재연결 실패")
                    # 트레이 아이콘 색상 업데이트 (빨간색으로 변경)
                    self.update_tray_icon()
                    
            except Exception as e:
                print(f"❌ 서버 재연결 중 오류: {e}")
                logging.error(f"서버 재연결 중 오류: {e}")
                # 트레이 아이콘 색상 업데이트 (빨간색으로 변경)
                self.update_tray_icon()
        
        def process_tk_events(self):
            while not self.tk_event_queue.empty():
                func = self.tk_event_queue.get()
                try:
                    func()
                except Exception as e:
                    print(f"[TkEvent] 실행 오류: {e}")
            if self.root:
                self.root.after(100, self.process_tk_events)

    def main():
        """메인 함수 - 서버 IP 입력 및 트레이 클라이언트 실행"""
        print("🚀 UE CMS Tray Client")
        print("=" * 50)
        
        try:
            # 명령행 인수 파싱
            parser = argparse.ArgumentParser(description='UE CMS Tray Client')
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
            
            print("\n🚀 트레이 클라이언트 시작 중...")
            print("=" * 50)
            
            # 클라이언트 생성 및 실행
            client = UECMSTrayClient(server_url)
            
            # 클라이언트 이름 설정
            if client_name:
                client.client_name = client_name
                print(f"🔧 클라이언트 이름 설정: {client_name}")
            
            client.start()
            
        except KeyboardInterrupt:
            print("\n⏹️ 사용자에 의해 중지됨")
        except Exception as e:
            print(f"\n❌ 오류 발생: {e}")
            logging.error(f"트레이 클라이언트 실행 중 오류: {e}")
            import traceback
            traceback.print_exc()

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

except Exception as e:
    print("[예외 발생]", e)
    import traceback
    traceback.print_exc()
    input("계속하려면 엔터를 누르세요...") 