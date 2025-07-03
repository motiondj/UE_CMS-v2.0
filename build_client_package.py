#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UE CMS Client Package Builder
클라이언트를 실행 파일로 빌드하고 배포 패키지를 생성합니다.
"""

import os
import sys
import shutil
import subprocess
import zipfile
from datetime import datetime

def run_command(command, cwd=None):
    """명령어를 실행하고 결과를 반환합니다."""
    print(f"실행 중: {command}")
    try:
        result = subprocess.run(command, shell=True, cwd=cwd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"오류: {result.stderr}")
            return False
        print(f"성공: {result.stdout}")
        return True
    except Exception as e:
        print(f"명령어 실행 실패: {e}")
        return False

def build_executables():
    """PyInstaller를 사용해서 실행 파일을 빌드합니다."""
    print("🔨 실행 파일 빌드 시작...")
    
    # 클라이언트 디렉토리로 이동
    os.chdir("client")
    
    # 기존 빌드 파일 정리
    if os.path.exists("dist"):
        shutil.rmtree("dist")
    if os.path.exists("build"):
        shutil.rmtree("build")
    
    # 일반 클라이언트 빌드
    print("📦 일반 클라이언트 빌드 중...")
    if not run_command("pyinstaller ue_cms_client.spec"):
        print("❌ 일반 클라이언트 빌드 실패")
        return False
    
    # 트레이 클라이언트 빌드
    print("📦 트레이 클라이언트 빌드 중...")
    if not run_command("pyinstaller ue_cms_tray_client.spec"):
        print("❌ 트레이 클라이언트 빌드 실패")
        return False
    
    print("✅ 실행 파일 빌드 완료")
    return True

def create_package():
    """배포 패키지를 생성합니다."""
    print("📦 배포 패키지 생성 중...")
    
    # 패키지 디렉토리 생성
    package_dir = "ue_cms_client_package"
    if os.path.exists(package_dir):
        shutil.rmtree(package_dir)
    os.makedirs(package_dir)
    
    # 실행 파일 복사
    shutil.copy2("dist/ue_cms_client.exe", package_dir)
    shutil.copy2("dist/ue_cms_tray_client.exe", package_dir)
    
    # 설정 파일 복사
    shutil.copy2("config_deploy.json", os.path.join(package_dir, "config.json"))
    
    # README 파일 복사
    shutil.copy2("README_DEPLOY.md", package_dir)
    
    # 배치 파일 생성
    create_batch_files(package_dir)
    
    print("✅ 배포 패키지 생성 완료")
    return package_dir

def create_batch_files(package_dir):
    """실행용 배치 파일을 생성합니다."""
    
    # 일반 클라이언트 실행 배치
    with open(os.path.join(package_dir, "start_client.bat"), "w", encoding="utf-8") as f:
        f.write("@echo off\n")
        f.write("echo UE CMS Client 시작 중...\n")
        f.write("ue_cms_client.exe\n")
        f.write("pause\n")
    
    # 트레이 클라이언트 실행 배치
    with open(os.path.join(package_dir, "start_tray_client.bat"), "w", encoding="utf-8") as f:
        f.write("@echo off\n")
        f.write("echo UE CMS Tray Client 시작 중...\n")
        f.write("ue_cms_tray_client.exe\n")
        f.write("echo 트레이 클라이언트가 백그라운드에서 실행 중입니다.\n")
        f.write("pause\n")

def create_zip_package(package_dir):
    """ZIP 패키지를 생성합니다."""
    print("📦 ZIP 패키지 생성 중...")
    
    zip_filename = f"ue_cms_client_package_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    
    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(package_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, package_dir)
                zipf.write(file_path, arcname)
    
    print(f"✅ ZIP 패키지 생성 완료: {zip_filename}")
    return zip_filename

def main():
    """메인 함수"""
    print("🚀 UE CMS Client Package Builder")
    print("=" * 50)
    
    # 현재 디렉토리 확인
    if not os.path.exists("client"):
        print("❌ client 디렉토리를 찾을 수 없습니다.")
        print("이 스크립트는 프로젝트 루트 디렉토리에서 실행해야 합니다.")
        return
    
    # PyInstaller 설치 확인
    try:
        import PyInstaller
        print(f"✅ PyInstaller 버전: {PyInstaller.__version__}")
    except ImportError:
        print("❌ PyInstaller가 설치되지 않았습니다.")
        print("다음 명령어로 설치하세요: pip install pyinstaller")
        return
    
    # 빌드 실행
    if not build_executables():
        print("❌ 빌드 실패")
        return
    
    # 패키지 생성
    package_dir = create_package()
    if not package_dir:
        print("❌ 패키지 생성 실패")
        return
    
    # ZIP 패키지 생성
    zip_filename = create_zip_package(package_dir)
    
    print("\n🎉 패키징 완료!")
    print(f"📁 패키지 위치: {os.path.abspath(package_dir)}")
    print(f"📦 ZIP 파일: {os.path.abspath(zip_filename)}")
    print("\n📋 다음 단계:")
    print("1. ZIP 파일을 다른 컴퓨터로 전송")
    print("2. 압축 해제 후 config.json에서 서버 IP 설정")
    print("3. ue_cms_client.exe 또는 ue_cms_tray_client.exe 실행")

if __name__ == "__main__":
    main() 