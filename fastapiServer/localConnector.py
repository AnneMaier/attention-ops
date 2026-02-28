import os
import json

class LocalConnector:
    """
    로컬 파일 시스템을 사용하여 보고서를 관리하는 전용 클래스입니다.
    """
    def __init__(self):
        # 보고서가 저장될 로컬 기본 경로 설정
        self.base_path = "/app/storage/reports"
        if not os.path.exists(self.base_path):
            os.makedirs(self.base_path, exist_ok=True)
            print(f"🟢 INFO: 로컬 보고서 저장소 준비됨: {self.base_path}")

    def getReportContent(self, file_path: str):
        """
        로컬 경로에서 JSON 파일을 읽어 반환합니다.
        """
        full_path = os.path.join(self.base_path, file_path) if not file_path.startswith("/") else file_path
        
        if not os.path.exists(full_path):
            print(f"🔴 ERROR: 로컬 보고서 파일을 찾을 수 없습니다. Path: {full_path}")
            return None
        
        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"🔴 ERROR: 로컬 보고서 로드 중 에러 발생. Error: {e}")
            return None
            
    def saveReportContent(self, file_path: str, data: dict):
        """
        로컬 경로에 JSON 데이터를 저장합니다. (캡슐화 강화)
        """
        full_path = os.path.join(self.base_path, file_path) if not file_path.startswith("/") else file_path
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        try:
            with open(full_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"🔴 ERROR: 로컬 보고서 저장 중 에러 발생. Error: {e}")
            return False
    
    def deleteReportContent(self, file_path: str):
        """
        로컬 경로의 파일을 삭제합니다.
        """
        full_path = os.path.join(self.base_path, file_path) if not file_path.startswith("/") else file_path
        
        try:
            if os.path.exists(full_path):
                os.remove(full_path)
                print(f"🟢 INFO: 로컬 보고서 삭제 완료. Path: {full_path}")
                return True
            return False
        except Exception as e:
            print(f"🔴 ERROR: 로컬 보고서 삭제 중 에러 발생. Error: {e}")
            return False

# 단일 인스턴스 생성
local_connector = LocalConnector()
