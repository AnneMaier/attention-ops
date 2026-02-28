import os
import json
from mongoConnector import mongo_connector
from llmConnector import get_coaching_feedback
from summaryGenerator import createSummarySentence
from localConnector import local_connector

async def generateAndUploadReport(report_id: str, user_id: str, start_date: str, end_date: str):
    print(f"INFO: [Report {report_id[:8]}] 보고서 생성 시작.")
    
    try:
        sessions_result = mongo_connector.getSessionsByUserId(user_id, start_date, end_date, page_size=1000)
        sessions = sessions_result.get("sessions", [])
        
        if not sessions:
            mongo_connector.updateReportStatus(report_id, "FAILED")
            return

        analyzed_sessions = [mongo_connector.analyzeSessionWithAggregation(s['_id']) for s in sessions if s]
        initial_report_json = {
            "reportId": report_id,
            "userId": user_id,
            "dateRange": {"start": start_date, "end": end_date},
            "summary": {"totalSessions": len(analyzed_sessions)},
            "sessions": analyzed_sessions
        }
        print(f"INFO: [Report {report_id[:8]}] 1. 초기 보고서 JSON 생성 완료.")

        fact_summary = createSummarySentence(initial_report_json)
        print(f"INFO: [Report {report_id[:8]}] 2. Python 기반 사실 요약 생성 완료.")

        coaching_feedback = await get_coaching_feedback(fact_summary)
        print(f"INFO: [Report {report_id[:8]}] 3. AI 코칭 피드백 생성 완료.")

        initial_report_json["llmSummary"] = fact_summary
        initial_report_json["coachingFeedback"] = coaching_feedback
        
        # [로컬 저장] 전용 커넥터를 사용하여 캡슐화된 방식으로 저장합니다.
        file_relative_path = f"{user_id}/{report_id}.json"
        
        success = local_connector.saveReportContent(file_relative_path, initial_report_json)
            
        if success:
            print(f"INFO: [Report {report_id[:8]}] 4. 최종 보고서 로컬 저장 완료.")
            mongo_connector.updateReportStatus(report_id, "COMPLETED", storage_path=file_relative_path)
        else:
            raise Exception("로컬 파일 저장 실패")
            
        print(f"✅ SUCCESS: [Report {report_id[:8]}] 모든 보고서 생성 과정 완료.")

    except Exception as e:
        print(f"🔴 ERROR: [Report {report_id[:8]}] 보고서 생성 중 예외 발생: {e}")
        mongo_connector.updateReportStatus(report_id, "FAILED")