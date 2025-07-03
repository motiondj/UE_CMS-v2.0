#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UE CMS Client - 서버 설정 도구
서버 IP를 쉽게 설정할 수 있는 도구입니다.
"""

import json
import os
import socket
import sys
from datetime import datetime

def get_network_info():
    """현재 네트워크 정보를 가져옵니다."""
    try:
        import psutil
        network_info = []
        for iface, addrs in psutil.net_if_addrs().items():
            for addr in addrs:
                if addr.family == socket.AF_INET and not addr.address.startswith("127."):
                    if (addr.address.startswith("192.168.") or 
                        addr.address.startswith("10.") or 
                        addr.address.startswith("172.")):
                        network_info.append({
                            'interface': iface,
                            'ip': addr.address
                        })
        return network_info
    except ImportError:
        return []

def load_config(config_file='config.json'):
    """설정 파일을 로드합니다."""
    try:
        if os.path.exists(config_file):
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        print(f"⚠️ 설정 파일 로드 실패: {e}")
    return {}

def save_config(config_data, config_file='config.json'):
    """설정을 파일에 저장합니다."""
    try:
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"❌ 설정 파일 저장 실패: {e}")
        return False

def test_connection(server_url):
    """서버 연결을 테스트합니다."""
    try:
        import requests
        print(f"🔍 서버 연결 테스트 중: {server_url}")
        response = requests.get(f"{server_url}/api/clients", timeout=5)
        if response.status_code == 200:
            print("✅ 서버 연결 성공!")
            return True
        else:
            print(f"⚠️ 서버 응답: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 서버 연결 실패: {e}")
        return False

def main():
    """메인 함수"""
    print("🔧 UE CMS Client - 서버 설정 도구")
    print("=" * 50)
    
    # 현재 설정 로드
    config = load_config()
    current_server = config.get('server_url', 'http://localhost:8000')
    
    print(f"📋 현재 설정:")
    print(f"   서버: {current_server}")
    print(f"   클라이언트 이름: {config.get('client_name', socket.gethostname())}")
    
    # 네트워크 정보 표시
    network_info = get_network_info()
    if network_info:
        print(f"\n🌐 현재 네트워크 정보:")
        for i, info in enumerate(network_info, 1):
            print(f"   {i}. {info['interface']}: {info['ip']}")
    
    print(f"\n📡 서버 설정")
    print("-" * 30)
    print("1. 서버 IP 주소 입력")
    print("2. 연결 테스트")
    print("3. 설정 저장")
    print("4. 종료")
    
    while True:
        try:
            choice = input("\n선택하세요 (1-4): ").strip()
            
            if choice == '1':
                print(f"\n💡 서버 IP 주소를 입력하세요:")
                print(f"   현재 설정: {current_server}")
                print(f"   예시: 192.168.1.100")
                print(f"   또는 전체 URL: http://192.168.1.100:8000")
                print(f"   (Enter만 누르면 현재 설정 유지)")
                
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
                    
                    current_server = server_url
                    print(f"✅ 서버 주소 설정: {server_url}")
                else:
                    print("ℹ️ 현재 설정을 유지합니다.")
            
            elif choice == '2':
                if test_connection(current_server):
                    print("🎉 서버 연결이 정상입니다!")
                else:
                    print("⚠️ 서버 연결에 문제가 있습니다.")
                    print("   - 서버가 실행 중인지 확인")
                    print("   - 방화벽 설정 확인")
                    print("   - IP 주소가 올바른지 확인")
            
            elif choice == '3':
                config_data = {
                    'server_url': current_server,
                    'client_name': config.get('client_name', socket.gethostname()),
                    'saved_at': datetime.now().isoformat()
                }
                
                if save_config(config_data):
                    print("✅ 설정이 저장되었습니다!")
                    print(f"   파일: {os.path.abspath('config.json')}")
                else:
                    print("❌ 설정 저장에 실패했습니다.")
            
            elif choice == '4':
                print("👋 설정 도구를 종료합니다.")
                break
            
            else:
                print("❌ 잘못된 선택입니다. 1-4 중에서 선택하세요.")
                
        except KeyboardInterrupt:
            print("\n👋 설정 도구를 종료합니다.")
            break
        except Exception as e:
            print(f"❌ 오류 발생: {e}")

if __name__ == "__main__":
    main() 