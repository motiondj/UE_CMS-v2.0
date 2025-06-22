#!/usr/bin/env python3
# -*- coding: utf-8 -*-

print("=== 테스트 시작 ===")

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

print("=== 모든 import 완료 ===")

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('test.log'),
        logging.StreamHandler()
    ]
)

print("=== 로깅 설정 완료 ===")

def main():
    print("🚀 간단한 테스트 클라이언트 시작...")
    
    server_url = "http://localhost:8000"
    client_name = "TestClient3"
    
    try:
        # 1. 서버 연결 테스트
        print("1. 서버 연결 테스트...")
        response = requests.get(f"{server_url}/api/health")
        if response.status_code == 200:
            print("✅ 서버 연결 성공")
        else:
            print(f"❌ 서버 연결 실패: {response.status_code}")
            return
        
        # 2. 클라이언트 등록 테스트
        print("2. 클라이언트 등록 테스트...")
        client_info = {
            'name': client_name,
            'ip_address': '127.0.0.1',
            'port': 8081
        }
        
        response = requests.post(f"{server_url}/api/clients", json=client_info)
        if response.status_code == 200:
            print("✅ 클라이언트 등록 성공")
            client_data = response.json()
            print(f"   클라이언트 ID: {client_data['id']}")
        else:
            print(f"❌ 클라이언트 등록 실패: {response.text}")
            return
        
        # 3. Socket.io 연결 테스트
        print("3. Socket.io 연결 테스트...")
        sio = socketio.Client()
        
        @sio.event
        def connect():
            print("✅ Socket.io 연결 성공")
            sio.emit('register_client', {
                'name': client_name,
                'clientType': 'python'
            })
        
        @sio.event
        def disconnect():
            print("❌ Socket.io 연결 해제")
        
        sio.connect(server_url)
        
        # 4. 연결 유지
        print("4. 연결 유지 중... (Ctrl+C로 종료)")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n🛑 사용자에 의해 종료됨")
        finally:
            sio.disconnect()
            
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()

print("=== 테스트 완료 ===") 