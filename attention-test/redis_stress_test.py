import redis
import json
import time
import datetime

# [Configuration]
# 테스트 환경에 맞게 Redis 접속 정보를 설정합니다.
REDIS_HOST = 'localhost'
REDIS_PORT = 6379

# [중요] 실제 운영 중인 Saver 서비스가 구독(Subscribe)하고 있는 채널명과 일치해야 합니다.
# rust/src/main.rs 또는 python/saver.py의 채널 상수 값을 확인하십시오.
CHANNEL_NAME = 'attention-meaningful-events' 
MESSAGE_COUNT = 10000 

def run_stress_test():
    """
    Redis Pub/Sub 파이프라인의 처리량(Throughput) 및 안정성을 검증하기 위한 부하 테스트 스크립트입니다.
    지정된 수량의 더미 데이터를 빠르게 발행(Publish)하여 Consumer(Saver)의 처리 성능을 측정합니다.
    """
    try:
        # Redis 클라이언트 초기화
        r = redis.StrictRedis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
        
        print(f"[INFO] Redis 서버({REDIS_HOST}:{REDIS_PORT}) 연결 성공")
        print(f"[INFO] 대상 채널: '{CHANNEL_NAME}'")
        print(f"[INFO] 총 {MESSAGE_COUNT}개의 테스트 메시지 전송을 시작합니다...")

        start_time = time.time()

        # 1. 대량의 데이터 전송 시뮬레이션 (Data Ingestion Simulation)
        # 웹소켓 서버에서 유입되는 고속의 센서 데이터를 모방하여 Redis로 전송합니다.
        for i in range(MESSAGE_COUNT):
            payload = {
                "sessionId": "stress-test-session",
                "userId": "load-tester",
                "eventType": "data",
                "timestamp": time.time(),
                "payload": {
                    "ear": 0.25,  # Eye Aspect Ratio (눈 깜빡임 지표)
                    "mar": 0.01,  # Mouth Aspect Ratio (하품 지표)
                    "yaw": 0.05,  # Head Pose (고개 떨굼 지표)
                    "sequence": i # 데이터 정합성 확인을 위한 인덱스
                }
            }
            # 직렬화 후 메시지 발행
            r.publish(CHANNEL_NAME, json.dumps(payload))
            
            # 필요 시 전송 속도 조절 (Throttling)
            # time.sleep(0.0001) 

        # 2. 세션 종료 시그널(Sentinel Value) 전송
        # Consumer(Saver)가 모든 데이터 처리를 완료하고 상태를 업데이트하는 시점을 측정하기 위함입니다.
        end_signal = {
            "sessionId": "stress-test-session",
            "eventType": "SESSION_END",
            "timestamp": time.time()
        }
        r.publish(CHANNEL_NAME, json.dumps(end_signal))

        end_time = time.time()
        duration = end_time - start_time
        rps = MESSAGE_COUNT / duration if duration > 0 else 0

        # 결과 리포트 출력
        print("-" * 60)
        print(f"✅ [Test Completed] 메시지 발행이 완료되었습니다.")
        print(f" - 총 소요 시간: {duration:.4f} sec")
        print(f" - 평균 전송 속도(Throughput): {rps:.2f} msg/sec")
        print(f" - 종료 시각(Timestamp): {datetime.datetime.now().strftime('%H:%M:%S.%f')}")
        print("-" * 60)
        print("[Next Step] Saver 서비스의 로그를 확인하여 데이터 처리 지연(Lag) 시간을 측정하십시오.")

    except Exception as e:
        print(f"[ERROR] 테스트 실행 중 예외가 발생했습니다: {e}")

if __name__ == "__main__":
    run_stress_test()