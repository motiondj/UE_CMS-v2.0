#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import shutil
import zipfile
from datetime import datetime
import subprocess

def build_client_package():
    """클라이언트 패키지를 빌드합니다."""
    
    print("🚀 UE CMS Client 패키지 빌드 시작")
    print("=" * 50)
    
    # 현재 디렉토리 확인
    current_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(current_dir)
    
    # 빌드 디렉토리 생성
    build_dir = "ue_cms_client_package"
    if os.path.exists(build_dir):
        shutil.rmtree(build_dir)
    os.makedirs(build_dir)
    
    print("📦 패키지 파일 준비 중...")
    
    # 필수 파일들 복사
    files_to_copy = [
        ("dist/ue_cms_client.exe", "ue_cms_client.exe"),
        ("start_client_interactive.bat", "start_client_interactive.bat"),
        ("config.json", "config.json"),
        ("README_DEPLOY.md", "README_DEPLOY.md")
    ]
    
    for src_path, dest_name in files_to_copy:
        if os.path.exists(src_path):
            shutil.copy2(src_path, os.path.join(build_dir, dest_name))
            print(f"✅ {dest_name} 복사됨")
        else:
            print(f"⚠️ {src_path} 파일이 없습니다")
    
    # ZIP 파일 생성
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    zip_filename = f"ue_cms_client_package_{timestamp}.zip"
    
    print(f"\n📦 ZIP 패키지 생성 중: {zip_filename}")
    
    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(build_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, build_dir)
                zipf.write(file_path, arcname)
                print(f"   📄 {arcname}")
    
    print(f"\n✅ 패키지 빌드 완료: {zip_filename}")
    print(f"📁 패키지 크기: {os.path.getsize(zip_filename) / 1024 / 1024:.1f} MB")
    
    # 빌드 디렉토리 정리
    shutil.rmtree(build_dir)
    print("🧹 임시 파일 정리 완료")
    
    print("\n📋 배포 방법:")
    print("1. ZIP 파일을 다른 PC에 복사")
    print("2. 압축 해제")
    print("3. start_client_interactive.bat 실행")
    print("4. 서버 IP 주소 입력")
    print("5. 클라이언트가 자동으로 연결됨")
    
    return zip_filename

if __name__ == "__main__":
    try:
        zip_file = build_client_package()
        print(f"\n🎉 패키지 빌드 성공: {zip_file}")
    except Exception as e:
        print(f"\n❌ 패키지 빌드 실패: {e}")
        sys.exit(1) 