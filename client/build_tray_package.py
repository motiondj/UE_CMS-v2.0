#!/usr/bin/env python3
"""
UE CMS Tray Client 패키지 빌드 스크립트
"""

import os
import shutil
import zipfile
from datetime import datetime

def build_tray_package():
    print("🚀 UE CMS Tray Client 패키지 빌드 시작")
    print("=" * 50)
    
    # 패키지 디렉토리 생성
    package_dir = f'tray_client_package_{datetime.now().strftime("%Y%m%d_%H%M%S")}'
    os.makedirs(package_dir, exist_ok=True)
    
    print("📦 패키지 파일 준비 중...")
    
    # 파일 복사
    files_to_copy = [
        ('dist/ue_cms_tray_client.exe', 'ue_cms_tray_client.exe'),
        ('start_client_tray_package.bat', 'start_client_tray.bat'),
        ('config.json', 'config.json'),
        ('README_DEPLOY.md', 'README_DEPLOY.md')
    ]
    
    for src, dst in files_to_copy:
        if os.path.exists(src):
            shutil.copy(src, os.path.join(package_dir, dst))
            print(f"✅ {dst} 복사됨")
        else:
            print(f"❌ {src} 파일을 찾을 수 없음")
    
    # ZIP 파일 생성
    zip_filename = f'{package_dir}.zip'
    print(f"📦 ZIP 패키지 생성 중: {zip_filename}")
    
    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(package_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, package_dir)
                zipf.write(file_path, arcname)
                print(f"   📄 {arcname}")
    
    # 패키지 크기 계산
    package_size = os.path.getsize(zip_filename) / (1024 * 1024)
    
    # 임시 디렉토리 정리
    shutil.rmtree(package_dir)
    
    print()
    print(f"✅ 패키지 빌드 완료: {zip_filename}")
    print(f"📁 패키지 크기: {package_size:.1f} MB")
    print("🧹 임시 파일 정리 완료")
    print()
    print("📋 배포 방법:")
    print("1. ZIP 파일을 다른 PC에 복사")
    print("2. 압축 해제")
    print("3. start_client_tray.bat 실행")
    print("4. 서버 IP 주소 입력")
    print("5. 클라이언트가 자동으로 연결됨")
    print()
    print(f"🎉 패키지 빌드 성공: {zip_filename}")

if __name__ == "__main__":
    build_tray_package() 