import ws from 'k6/ws';
import { check } from 'k6';

// 테스트 설정: 가상 유저(VU) 50명이 30초 동안 공격
export const options = {
    vus: 50,
    duration: '30s',
};

// 더미 데이터 생성 (필수 랜드마크 포인트 포함)
// Rust 서버가 인덱스 참조 에러(Panic)를 일으키지 않도록 계산에 필요한 모든 포인트를 포함해야 함.
const keyIndices = [
    1, 6, 10, 13, 14, 33, 61, 81, 133, 144, 152, 153, 158, 160, 178,
    234, 263, 291, 311, 362, 373, 380, 385, 387, 402, 454
];

const dummyLandmarks = keyIndices.map(idx => ({
    index: idx,
    x: Math.random(),
    y: Math.random(),
    z: Math.random()
}));

const payload = JSON.stringify({
    sessionId: "test-session",
    userId: "test-user",
    eventType: "data",
    payload: {
        landmarks: dummyLandmarks
    }
});

export default function () {
    // [중요] 테스트 대상 URL 설정
    // Rust 테스트 시: 'ws://localhost:9001'
    // Python 테스트 시: 'ws://localhost:9002'
    const url = __ENV.TARGET_URL || 'ws://localhost:9001';

    const res = ws.connect(url, {}, function (socket) {
        socket.on('open', () => {
            // 30fps 시뮬레이션 (약 33ms마다 데이터 전송)
            socket.setInterval(() => {
                socket.send(payload);
            }, 33);
        });

        socket.on('close', () => console.log('disconnected'));

        // 에러 발생 시 로깅
        socket.on('error', (e) => {
            if (e.error() != "websocket: close sent") {
                console.log('An unexpected error occured: ', e.error());
            }
        });
    });

    check(res, { 'status is 101': (r) => r && r.status === 101 });
}