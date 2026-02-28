import asyncio
import websockets
import json
import math
import time

# --- Rust 서버와 동일한 계산 로직 구현 ---

def get_distance(p1, p2):
    return math.sqrt((p1['x'] - p2['x'])**2 + (p1['y'] - p2['y'])**2)

def get_ear(landmarks):
    # landmarks 리스트가 6개 미만이면 계산 불가 (Rust의 panic 방지 로직과 유사하게 처리)
    if len(landmarks) < 6: return 0.0
    ver_dist1 = get_distance(landmarks[1], landmarks[5])
    ver_dist2 = get_distance(landmarks[2], landmarks[4])
    hor_dist = get_distance(landmarks[0], landmarks[3])
    if hor_dist == 0.0: return 0.0
    return (ver_dist1 + ver_dist2) / (2.0 * hor_dist)

def get_mar(landmarks):
    if len(landmarks) < 8: return 0.0
    ver_dist1 = get_distance(landmarks[2], landmarks[5])
    ver_dist2 = get_distance(landmarks[3], landmarks[6])
    ver_dist3 = get_distance(landmarks[4], landmarks[7])
    hor_dist = get_distance(landmarks[0], landmarks[1])
    if hor_dist == 0.0: return 0.0
    return (ver_dist1 + ver_dist2 + ver_dist3) / (3.0 * hor_dist)

def get_head_yaw(landmarks_map):
    nose = landmarks_map.get(1)
    left_cheek = landmarks_map.get(234)
    right_cheek = landmarks_map.get(454)
    
    if nose and left_cheek and right_cheek:
        dist_left = abs(nose['x'] - left_cheek['x'])
        dist_right = abs(right_cheek['x'] - nose['x'])
        if (dist_left + dist_right) == 0.0: return 0.0
        return (dist_right - dist_left) / (dist_left + dist_right)
    return 0.0

# 랜드마크 인덱스 추출 헬퍼
def get_landmarks_by_indices(landmarks_map, indices):
    return [landmarks_map[i] for i in indices if i in landmarks_map]

async def handler(websocket):
    try:
        async for message in websocket:
            try:
                # 1. JSON 파싱
                data = json.loads(message)
                
                # 2. 'data' 이벤트일 때만 계산 수행 (Rust 로직과 동일)
                if data.get('eventType') == 'data':
                    payload = data.get('payload', {})
                    raw_landmarks = payload.get('landmarks', [])
                    
                    # 리스트를 맵으로 변환 (인덱스 검색 최적화)
                    landmarks_map = {lm['index']: lm for lm in raw_landmarks}
                    
                    # 3. 핵심 지표 계산 (CPU Intensive 작업 시뮬레이션)
                    # 눈 (Left/Right)
                    ear_left = get_ear(get_landmarks_by_indices(landmarks_map, [362, 385, 387, 263, 373, 380]))
                    ear_right = get_ear(get_landmarks_by_indices(landmarks_map, [33, 160, 158, 133, 153, 144]))
                    # 입
                    mar = get_mar(get_landmarks_by_indices(landmarks_map, [61, 291, 13, 81, 178, 14, 311, 402]))
                    # 고개
                    head_yaw = get_head_yaw(landmarks_map)
                    
                    # (테스트용) 계산 결과 로그 출력 대신, 그냥 패스 (I/O 병목 제거하고 CPU 부하만 측정하기 위함)
                    # print(f"EAR: {ear_left}, MAR: {mar}") 

            except json.JSONDecodeError:
                pass
            except Exception as e:
                # print(f"Error: {e}")
                pass
    except Exception:
        pass

async def main():
    # Python Websocket 서버를 9002번 포트로 실행
    print("🚀 Python WebSocket Server started on port 9002")
    async with websockets.serve(handler, "0.0.0.0", 9002):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())