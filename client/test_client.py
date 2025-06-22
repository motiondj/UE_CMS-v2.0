import requests
import json
import time

def test_server_connection():
    """서버 연결 테스트"""
    try:
        response = requests.get('http://localhost:8000/api/status')
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 서버 연결 성공: {data}")
            return True
        else:
            print(f"❌ 서버 연결 실패: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 서버 연결 오류: {e}")
        return False

def test_clients_api():
    """클라이언트 API 테스트"""
    try:
        # 클라이언트 목록 조회
        response = requests.get('http://localhost:8000/api/clients')
        if response.status_code == 200:
            clients = response.json()
            print(f"✅ 클라이언트 목록 조회 성공: {len(clients)}개 클라이언트")
            for client in clients:
                print(f"  - {client['name']} ({client['ip_address']}) - {client['status']}")
        else:
            print(f"❌ 클라이언트 목록 조회 실패: {response.status_code}")
            return False
        
        # 새 클라이언트 추가
        new_client = {
            "name": "Test_Display_01",
            "ip_address": "192.168.1.101",
            "port": 8081
        }
        
        response = requests.post('http://localhost:8000/api/clients', json=new_client)
        if response.status_code == 201:
            added_client = response.json()
            print(f"✅ 클라이언트 추가 성공: {added_client}")
        else:
            print(f"❌ 클라이언트 추가 실패: {response.status_code} - {response.text}")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ 클라이언트 API 테스트 오류: {e}")
        return False

def test_groups_api():
    """그룹 API 테스트"""
    try:
        # 그룹 목록 조회
        response = requests.get('http://localhost:8000/api/groups')
        if response.status_code == 200:
            groups = response.json()
            print(f"✅ 그룹 목록 조회 성공: {len(groups)}개 그룹")
            for group in groups:
                print(f"  - {group['name']}")
        else:
            print(f"❌ 그룹 목록 조회 실패: {response.status_code}")
            return False
        
        # 새 그룹 추가
        new_group = {"name": "Test_Group_01"}
        
        response = requests.post('http://localhost:8000/api/groups', json=new_group)
        if response.status_code == 201:
            added_group = response.json()
            print(f"✅ 그룹 추가 성공: {added_group}")
        else:
            print(f"❌ 그룹 추가 실패: {response.status_code} - {response.text}")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ 그룹 API 테스트 오류: {e}")
        return False

def test_presets_api():
    """프리셋 API 테스트"""
    try:
        # 프리셋 목록 조회
        response = requests.get('http://localhost:8000/api/presets')
        if response.status_code == 200:
            presets = response.json()
            print(f"✅ 프리셋 목록 조회 성공: {len(presets)}개 프리셋")
            for preset in presets:
                print(f"  - {preset['name']}: {preset['command']}")
        else:
            print(f"❌ 프리셋 목록 조회 실패: {response.status_code}")
            return False
        
        # 새 프리셋 추가
        new_preset = {
            "name": "Test_Unreal_Engine",
            "command": "C:\\Program Files\\Epic Games\\UE_5.3\\Engine\\Binaries\\Win64\\UnrealEditor.exe -ndisplay",
            "target_group_id": None
        }
        
        response = requests.post('http://localhost:8000/api/presets', json=new_preset)
        if response.status_code == 201:
            added_preset = response.json()
            print(f"✅ 프리셋 추가 성공: {added_preset}")
            
            # 프리셋 실행 테스트 (실제로는 클라이언트가 연결되어야 함)
            preset_id = added_preset['id']
            response = requests.post(f'http://localhost:8000/api/presets/{preset_id}/execute')
            if response.status_code == 200:
                result = response.json()
                print(f"✅ 프리셋 실행 성공: {result}")
            else:
                print(f"⚠️ 프리셋 실행 실패 (클라이언트 없음): {response.status_code}")
        else:
            print(f"❌ 프리셋 추가 실패: {response.status_code} - {response.text}")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ 프리셋 API 테스트 오류: {e}")
        return False

def main():
    """메인 테스트 함수"""
    print("🧪 Switchboard Plus MVP API 테스트 시작")
    print("=" * 50)
    
    # 서버 연결 테스트
    if not test_server_connection():
        print("❌ 서버 연결 실패로 테스트 중단")
        return
    
    print("\n" + "=" * 50)
    
    # 클라이언트 API 테스트
    print("📱 클라이언트 API 테스트")
    test_clients_api()
    
    print("\n" + "=" * 50)
    
    # 그룹 API 테스트
    print("👥 그룹 API 테스트")
    test_groups_api()
    
    print("\n" + "=" * 50)
    
    # 프리셋 API 테스트
    print("⚡ 프리셋 API 테스트")
    test_presets_api()
    
    print("\n" + "=" * 50)
    print("✅ MVP API 테스트 완료!")

if __name__ == "__main__":
    main() 