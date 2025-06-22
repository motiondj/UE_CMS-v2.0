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
    def __init__(self, server_url="http://localhost:8000", client_name=None, client_id=None):
        self.server_url = server_url
        self.client_name = client_name or f"Client_{os.getpid()}"
        self.client_id = client_id
        self.sio = socketio.Client()
        self.running = False
        self.execution_history = []
        
        # Socket.io 이벤트 핸들러 등록
        self.sio.on('connect', self.on_connect)
        self.sio.on('disconnect', self.on_disconnect)
        self.sio.on('execute_command', self.on_execute_command)
        
        # 서버에 클라이언트 등록
        self.register_client()
    
    def register_client(self):
        """서버에 클라이언트를 등록합니다."""
        try:
            # 클라이언트 정보 수집
            client_info = {
                'name': self.client_name,
                'ip_address': self.get_local_ip(),
                'port': 8081
            }
            
            # 서버에 클라이언트 등록
            response = requests.post(f"{self.server_url}/api/clients", json=client_info)
            
            if response.status_code == 200:
                client_data = response.json()
                self.client_id = client_data['id']
                logging.info(f"클라이언트가 등록되었습니다. ID: {self.client_id}")
                
                # Socket.io 연결
                self.connect_socket()
            else:
                logging.error(f"클라이언트 등록 실패: {response.text}")
                
        except Exception as e:
            logging.error(f"클라이언트 등록 중 오류: {e}")
    
    def get_local_ip(self):
        """로컬 IP 주소를 가져옵니다."""
        try:
            # 간단한 방법으로 로컬 IP 가져오기
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"
    
    def connect_socket(self):
        """Socket.io 연결을 설정합니다."""
        try:
            self.sio.connect(self.server_url)
            self.running = True
            logging.info("Socket.io 연결이 설정되었습니다.")
        except Exception as e:
            logging.error(f"Socket.io 연결 실패: {e}")
    
    def on_connect(self):
        """Socket.io 연결 시 호출됩니다."""
        logging.info("서버에 연결되었습니다.")
        self.update_status('online')
    
    def on_disconnect(self):
        """Socket.io 연결 해제 시 호출됩니다."""
        logging.info("서버와의 연결이 해제되었습니다.")
        self.update_status('offline')
    
    def update_status(self, status):
        """클라이언트 상태를 서버에 업데이트합니다."""
        if self.client_id:
            self.sio.emit('client_status_update', {
                'clientId': self.client_id,
                'status': status
            })
    
    def on_execute_command(self, data):
        """서버로부터 명령 실행 요청을 받습니다."""
        try:
            command = data.get('command')
            preset_id = data.get('presetId')
            target_client_id = data.get('clientId')
            
            # 이 클라이언트가 대상인지 확인
            if target_client_id and target_client_id != self.client_id:
                return
            
            logging.info(f"명령 실행 요청: {command}")
            
            # 명령 실행
            result = self.execute_command(command)
            
            # 실행 결과를 서버에 전송
            self.sio.emit('execution_result', {
                'executionId': data.get('executionId'),
                'status': 'completed' if result['success'] else 'failed',
                'result': result
            })
            
        except Exception as e:
            logging.error(f"명령 실행 중 오류: {e}")
            self.sio.emit('execution_result', {
                'executionId': data.get('executionId'),
                'status': 'failed',
                'result': {'error': str(e)}
            })
    
    def execute_command(self, command):
        """실제 명령을 실행합니다."""
        try:
            logging.info(f"명령 실행: {command}")
            
            # 명령 타입에 따른 처리
            if command.startswith('unreal://'):
                return self.execute_unreal_command(command)
            elif command.startswith('system://'):
                return self.execute_system_command(command)
            else:
                return self.execute_generic_command(command)
                
        except Exception as e:
            logging.error(f"명령 실행 실패: {e}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def execute_unreal_command(self, command):
        """언리얼엔진 관련 명령을 실행합니다."""
        try:
            # unreal:// 프로토콜 파싱
            command_parts = command.replace('unreal://', '').split('/')
            
            if len(command_parts) < 2:
                return {
                    'success': False,
                    'error': '잘못된 언리얼 명령 형식',
                    'timestamp': datetime.now().isoformat()
                }
            
            action = command_parts[0]
            project_path = '/'.join(command_parts[1:])
            
            if action == 'launch':
                return self.launch_unreal_project(project_path)
            elif action == 'ndisplay':
                return self.launch_ndisplay(project_path)
            else:
                return {
                    'success': False,
                    'error': f'지원하지 않는 언리얼 액션: {action}',
                    'timestamp': datetime.now().isoformat()
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def launch_unreal_project(self, project_path):
        """언리얼엔진 프로젝트를 실행합니다."""
        try:
            # 언리얼엔진 실행 파일 경로 (기본값)
            unreal_paths = [
                "C:/Program Files/Epic Games/UE_5.3/Engine/Binaries/Win64/UnrealEditor.exe",
                "C:/Program Files/Epic Games/UE_5.2/Engine/Binaries/Win64/UnrealEditor.exe",
                "C:/Program Files/Epic Games/UE_5.1/Engine/Binaries/Win64/UnrealEditor.exe",
                "C:/Program Files/Epic Games/UE_5.0/Engine/Binaries/Win64/UnrealEditor.exe"
            ]
            
            unreal_exe = None
            for path in unreal_paths:
                if os.path.exists(path):
                    unreal_exe = path
                    break
            
            if not unreal_exe:
                return {
                    'success': False,
                    'error': '언리얼엔진을 찾을 수 없습니다.',
                    'timestamp': datetime.now().isoformat()
                }
            
            # 프로젝트 파일 경로 확인
            if not os.path.exists(project_path):
                return {
                    'success': False,
                    'error': f'프로젝트 파일을 찾을 수 없습니다: {project_path}',
                    'timestamp': datetime.now().isoformat()
                }
            
            # 언리얼엔진 실행
            cmd = [unreal_exe, project_path]
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            return {
                'success': True,
                'message': f'언리얼엔진 프로젝트가 실행되었습니다: {project_path}',
                'process_id': process.pid,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def launch_ndisplay(self, project_path):
        """nDisplay를 실행합니다."""
        try:
            # nDisplay 실행 파일 경로
            ndisplay_paths = [
                "C:/Program Files/Epic Games/UE_5.3/Engine/Binaries/Win64/nDisplayLauncher.exe",
                "C:/Program Files/Epic Games/UE_5.2/Engine/Binaries/Win64/nDisplayLauncher.exe",
                "C:/Program Files/Epic Games/UE_5.1/Engine/Binaries/Win64/nDisplayLauncher.exe",
                "C:/Program Files/Epic Games/UE_5.0/Engine/Binaries/Win64/nDisplayLauncher.exe"
            ]
            
            ndisplay_exe = None
            for path in ndisplay_paths:
                if os.path.exists(path):
                    ndisplay_exe = path
                    break
            
            if not ndisplay_exe:
                return {
                    'success': False,
                    'error': 'nDisplay Launcher를 찾을 수 없습니다.',
                    'timestamp': datetime.now().isoformat()
                }
            
            # nDisplay 실행
            cmd = [ndisplay_exe, project_path]
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            return {
                'success': True,
                'message': f'nDisplay가 실행되었습니다: {project_path}',
                'process_id': process.pid,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def execute_system_command(self, command):
        """시스템 명령을 실행합니다."""
        try:
            # system:// 프로토콜 파싱
            system_command = command.replace('system://', '')
            
            # 명령 실행
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
    
    def execute_generic_command(self, command):
        """일반 명령을 실행합니다."""
        try:
            # 기본적으로 시스템 명령으로 처리
            return self.execute_system_command(f"system://{command}")
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def start(self):
        """클라이언트를 시작합니다."""
        try:
            logging.info("Switchboard 클라이언트를 시작합니다...")
            
            # 메인 루프
            while self.running:
                time.sleep(1)
                
        except KeyboardInterrupt:
            logging.info("클라이언트를 종료합니다...")
        except Exception as e:
            logging.error(f"클라이언트 실행 중 오류: {e}")
        finally:
            self.stop()
    
    def stop(self):
        """클라이언트를 중지합니다."""
        self.running = False
        if self.sio.connected:
            self.sio.disconnect()
        logging.info("클라이언트가 중지되었습니다.")

def main():
    """메인 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Switchboard Plus Client')
    parser.add_argument('--server', default='http://localhost:8000', help='서버 URL')
    parser.add_argument('--name', help='클라이언트 이름')
    parser.add_argument('--id', type=int, help='클라이언트 ID')
    
    args = parser.parse_args()
    
    # 클라이언트 생성 및 시작
    client = SwitchboardClient(
        server_url=args.server,
        client_name=args.name,
        client_id=args.id
    )
    
    try:
        client.start()
    except KeyboardInterrupt:
        print("\n클라이언트를 종료합니다...")
    finally:
        client.stop()

if __name__ == "__main__":
    main() 