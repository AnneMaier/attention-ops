import React, { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { message, Modal, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { CameraOutlined, PauseCircleOutlined, PlayCircleOutlined, StopOutlined, WarningOutlined } from '@ant-design/icons';

const KEY_LANDMARK_INDICES = [1, 6, 10, 13, 14, 33, 61, 81, 133, 144, 152, 153, 158, 160, 178, 234, 263, 291, 311, 362, 373, 380, 385, 387, 402, 454];

const QUOTES = [
    { quote: "가장 큰 영광은 한 번도 실패하지 않음이 아니라 \n 실패할 때마다 다시 일어서는 데에 있다.", author: "공자" },
    { quote: "성공의 비결은 단 한 가지, \n 잘할 수 있는 일에 광적으로 집중하는 것이다.", author: "톰 모나건" },
    { quote: "오직 한 가지 성공이 있을 뿐이다. \n 바로 자기 자신만의 방식으로 삶을 살아갈 수 있느냐이다.", author: "크리스토퍼 몰리" },
    { quote: "집중력은 지성의 또 다른 이름이다.", author: "아서 쇼펜하우어" },
    { quote: "천 리 길도 한 걸음부터.", author: "노자" },
    { quote: "당신이 할 수 있다고 믿든 할 수 없다고 믿든,\n 믿는 대로 될 것이다.", author: "헨리 포드" },
    { quote: "오늘 할 수 있는 일에 전력을 다하라.\n 그러면 내일에는 한 걸음 더 진보해 있을 것이다.", author: "아이작 뉴턴" }
];

const SessionPage = () => {
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const timerRef = useRef(null); // 타이머 인터벌 보관용
    const reconnectAttemptsRef = useRef(0); // [추가] 재연결 시도 횟수
    const [timer, setTimer] = useState("00:00:00");
    const [sessionId] = useState('session-' + Date.now()); // 세션 진입 시 한 번만 생성
    const [connectionStatus, setConnectionStatus] = useState('connecting'); // connecting | connected | reconnecting | failed
    const [countdown, setCountdown] = useState(0); // [추가] 실시간 카운트다운 상테
    const connectionStatusRef = useRef('connecting'); // [추가] Stale Closure 방지용 Ref
    const [isPaused, setIsPaused] = useState(false);
    const [isCameraVisible, setIsCameraVisible] = useState(false);
    const [randomQuote, setRandomQuote] = useState(QUOTES[0]);
    const [warnings, setWarnings] = useState([]);
    const [isWarningListVisible, setIsWarningListVisible] = useState(false);
    const [modal, contextHolder] = Modal.useModal();


    // Refs for mutable state accessed in callbacks
    const wsRef = useRef(null);
    const faceLandmarkerRef = useRef(null);
    const sessionStartTimeRef = useRef(null);
    const pauseStartTimeRef = useRef(null);
    const elapsedPausedTimeRef = useRef(0);
    const isPausedRef = useRef(false); // For use in animation loop
    const latestLandmarksRef = useRef([]);
    const requestRef = useRef(null);
    const lastProcessTimeRef = useRef(0);

    // Audio Context
    const audioCtxRef = useRef(null);

    useEffect(() => {
        setRandomQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
        startApp();

        return () => {
            cleanup();
        };
    }, []);

    const cleanup = () => {
        if (wsRef.current) wsRef.current.close();
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        }
        if (faceLandmarkerRef.current) {
            faceLandmarkerRef.current.close();
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const startApp = async () => {
        console.log("🟢 애플리케이션 시작.");
        connectWebSocket();
        await initializeWebcam();
        await initializeMediaPipe();

        sessionStartTimeRef.current = new Date();
        timerRef.current = setInterval(updateSessionTimer, 1000);
    };

    const updateSessionTimer = () => {
        if (!sessionStartTimeRef.current || isPausedRef.current) return;
        const now = new Date();
        const elapsed = new Date(now - sessionStartTimeRef.current - elapsedPausedTimeRef.current);
        const hours = String(elapsed.getUTCHours()).padStart(2, '0');
        const minutes = String(elapsed.getUTCMinutes()).padStart(2, '0');
        const seconds = String(elapsed.getUTCSeconds()).padStart(2, '0');
        setTimer(`${hours}:${minutes}:${seconds}`);
    };

    const connectWebSocket = () => {
        const WEBSOCKET_URL = `ws://${window.location.hostname}:9001`; // Or use env var
        console.log(`🟡 WebSocket 연결 시도: ${WEBSOCKET_URL}`);
        setStatus("실시간 분석 서버에 연결 중...");

        const ws = new WebSocket(WEBSOCKET_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('✅ WebSocket 연결 성공.');
            // connectionStatusRef를 사용하여 최신 상태 참조 (Stale Closure 방지)
            const wasReconnecting = connectionStatusRef.current === 'reconnecting';

            setConnectionStatus('connected');
            connectionStatusRef.current = 'connected';
            reconnectAttemptsRef.current = 0;
            setCountdown(0);

            if (wasReconnecting) {
                message.success('서버와 다시 연결되었습니다!');
                setStatus("집중 분석 중");
            } else {
                setStatus("얼굴을 보여주세요.");
                setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN) setStatus("집중 분석 중");
                }, 5000);
            }

            sendEvent('start', { userAgent: navigator.userAgent });
        };

        ws.onmessage = (event) => {
            const alarmMessage = event.data;
            console.log(`🔔 서버로부터 메시지 수신: ${alarmMessage}`);
            setStatus(`🚨 ${alarmMessage}`);
            addWarning(alarmMessage);
            playWarningBeep();
            message.warning(alarmMessage);
        };

        ws.onclose = () => {
            console.log('🔌 WebSocket 연결 종료.');

            if (reconnectAttemptsRef.current < 5) {
                setConnectionStatus('reconnecting');
                connectionStatusRef.current = 'reconnecting';

                // 표준 지수 백오프 공식 적용 (Claude 제안)
                const nextDelay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
                reconnectAttemptsRef.current += 1;

                const secondsToWait = Math.round(nextDelay / 1000);
                setCountdown(secondsToWait);

                setStatus(`서버 연결 끊김. ${secondsToWait}초 후 재연결 시도... (${reconnectAttemptsRef.current}/5)`);
                setTimeout(connectWebSocket, nextDelay);
            } else {
                setConnectionStatus('failed');
                connectionStatusRef.current = 'failed';
                setStatus("서버 연결에 실패했습니다.");
                message.error('서버와의 연결이 완전히 끊겼습니다. 아래 버튼을 눌러 다시 시도하세요.', 0);
            }
        };

        ws.onerror = (error) => {
            console.error('🔴 WebSocket 에러:', error);
            setStatus("연결 에러가 발생했습니다.");
        };
    };

    const sendEvent = (eventType, payload) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const msg = {
            sessionId: sessionId, // 고정된 sessionId 사용
            userId: "1", // Hardcoded for now
            timestamp: new Date().toISOString(),
            eventType,
            payload
        };
        wsRef.current.send(JSON.stringify(msg));
    };

    const addWarning = (msg) => {
        const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
        setWarnings(prev => [{ time, msg }, ...prev]);
    };

    const playWarningBeep = () => {
        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume();
            }
            const oscillator = audioCtxRef.current.createOscillator();
            const gainNode = audioCtxRef.current.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtxRef.current.destination);
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtxRef.current.currentTime);
            gainNode.gain.setValueAtTime(0.5, audioCtxRef.current.currentTime);
            oscillator.start(audioCtxRef.current.currentTime);
            oscillator.stop(audioCtxRef.current.currentTime + 0.2);
        } catch (e) {
            console.error("Audio play failed", e);
        }
    };

    const initializeWebcam = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current.play();
                    requestRef.current = requestAnimationFrame(mainLoop);
                };
            }
        } catch (err) {
            console.error("Webcam init failed", err);
            setStatus("웹캠 권한을 확인해주세요.");
        }
    };

    const initializeMediaPipe = async () => {
        try {
            console.log("🟢 MediaPipe FaceLandmarker 초기화 시작");
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
            );
            const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                    delegate: "CPU"
                },
                outputFaceBlendshapes: true,
                runningMode: "VIDEO",
                numFaces: 1
            });
            faceLandmarkerRef.current = faceLandmarker;
            console.log("🟢 MediaPipe FaceLandmarker 초기화 완료");
        } catch (error) {
            console.error("🔴 MediaPipe 초기화 실패:", error);
            setStatus(`AI 모델 로드 실패: ${error.message}`);
            message.error(`AI 모델 로드 실패: ${error.message}`);
        }
    };

    const processResults = (results) => {
        if (isPausedRef.current) {
            latestLandmarksRef.current = [];
            return;
        }

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            latestLandmarksRef.current = results.faceLandmarks[0];

            const keyLandmarks = KEY_LANDMARK_INDICES.map(index => {
                const landmark = latestLandmarksRef.current[index];
                return { index, x: parseFloat(landmark.x.toFixed(4)), y: parseFloat(landmark.y.toFixed(4)), z: parseFloat(landmark.z.toFixed(4)) };
            });
            sendEvent('data', { landmarks: keyLandmarks });
        } else {
            latestLandmarksRef.current = [];
            sendEvent('status_update', { status: 'no_face_detected' });
        }
    };

    const mainLoop = async (currentTime) => {
        requestRef.current = requestAnimationFrame(mainLoop);

        if (videoRef.current && videoRef.current.readyState >= 3 && canvasRef.current && faceLandmarkerRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            // Set canvas size to match video
            if (canvas.width !== video.videoWidth) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            }

            // Detect faces
            if (!isPausedRef.current) {
                const startTimeMs = performance.now();
                const results = faceLandmarkerRef.current.detectForVideo(video, startTimeMs);
                processResults(results);
            }

            // Draw
            if (isCameraVisible) {
                ctx.save();
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // Draw landmarks
                if (latestLandmarksRef.current.length > 0) {
                    for (const index of KEY_LANDMARK_INDICES) {
                        const landmark = latestLandmarksRef.current[index];
                        if (landmark) {
                            const x = landmark.x * canvas.width;
                            const y = landmark.y * canvas.height;
                            ctx.beginPath();
                            ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
                            ctx.fillStyle = isPausedRef.current ? '#FFA500' : '#30FF30';
                            ctx.fill();
                        }
                    }
                }
                ctx.restore();
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    const togglePause = () => {
        const nextState = !isPaused;
        setIsPaused(nextState);
        isPausedRef.current = nextState;

        setStatus(nextState ? "⏸️ 일시정지됨" : "집중 분석 중");
        sendEvent('status_update', { status: nextState ? 'paused' : 'resumed' });

        if (nextState) {
            pauseStartTimeRef.current = new Date();
        } else {
            elapsedPausedTimeRef.current += new Date() - pauseStartTimeRef.current;
        }
    };

    useEffect(() => {
        if (isCameraVisible && videoRef.current) {
            console.log("📸 카메라 켜짐: 비디오 재생 시도");
            videoRef.current.play().catch(e => console.error("🔴 비디오 재생 실패:", e));
        }
    }, [isCameraVisible]);

    const toggleCamera = () => {
        setIsCameraVisible(!isCameraVisible);
    };

    const handleEndSession = (e) => {
        if (e) e.stopPropagation(); // 이벤트 전파 차단
        console.log("🔘 [SessionPage] 세션 종료 버튼 클릭됨");

        modal.confirm({
            title: '세션 종료',
            content: '정말로 현재 집중 세션을 종료하시겠습니까? 데이터가 저장되고 대시보드로 이동합니다.',
            okText: '종료',
            okType: 'danger',
            cancelText: '취소',
            centered: true, // 모바일에서 중앙 정렬 보장
            width: '90%', // 모바일 뷰포트 대응
            style: { top: 100, zIndex: 10001 }, // 수동 위치 및 zIndex 강화
            onOk() {
                console.log("✅ 세션 종료 확인됨");
                sendEvent('end', { reason: 'user_clicked_end_button' });
                cleanup();

                const hide = message.loading('리포트 생성 중...', 0);

                setTimeout(() => {
                    hide();
                    message.success('세션이 종료되었습니다.');
                    navigate('/reports', { state: { sessionEnded: true } });
                }, 2000);
            },
        });
    };

    // 실시간 카운트다운 타이머 이펙트
    useEffect(() => {
        let interval;
        if (connectionStatus === 'reconnecting' && countdown > 0) {
            interval = setInterval(() => {
                setCountdown(prev => {
                    const next = prev - 1;
                    if (next >= 0) {
                        setStatus(`서버 연결 끊김. ${next}초 후 재연결 시도... (${reconnectAttemptsRef.current}/5)`);
                    }
                    return next;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [connectionStatus, countdown]);

    return (
        <div className="min-h-screen bg-[#101923] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {contextHolder}
            {/* Quote Display */}
            {!isCameraVisible && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-10 pointer-events-none px-4">
                    <h2 className="text-3xl font-bold mb-4">"{randomQuote.quote}"</h2>
                    <p className="text-xl text-gray-400">- {randomQuote.author} -</p>
                </div>
            )}

            {/* Top Right Buttons - z-index 최상위로 격상 및 위치 미세 조정 */}
            <div className="fixed top-8 right-8 md:top-20 md:right-12 z-[100] flex flex-col gap-4 items-end pointer-events-auto">
                <Button
                    danger
                    type="primary"
                    icon={<StopOutlined />}
                    onClick={handleEndSession}
                    size="large"
                >
                    세션 종료
                </Button>
                <Button
                    type="primary"
                    icon={<WarningOutlined />}
                    onClick={() => setIsWarningListVisible(!isWarningListVisible)}
                    className="bg-blue-600 hover:bg-blue-500"
                    size="large"
                >
                    경고 리스트
                </Button>
            </div>

            {/* Warning List */}
            {isWarningListVisible && (
                <div className="fixed top-20 left-4 z-50 w-72 bg-[#1a232e]/90 backdrop-blur-md border border-[#314b68] rounded-lg p-4 shadow-xl max-h-[80vh] overflow-y-auto">
                    <h3 className="text-lg font-semibold mb-4 text-center">실시간 감지 로그</h3>
                    <div className="space-y-2 text-sm text-gray-300">
                        {warnings.map((w, i) => (
                            <p key={i}><span className="font-mono text-gray-500">[{w.time}]</span> {w.msg}</p>
                        ))}
                        {warnings.length === 0 && <p className="text-center text-gray-500">아직 경고가 없습니다.</p>}
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className={`relative w-full max-w-5xl aspect-video transition-opacity duration-300 ${isCameraVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="relative w-full h-full rounded-xl overflow-hidden border border-[#314b68] shadow-2xl bg-black">
                    <video ref={videoRef} className="w-full h-full object-cover transform -scale-x-100" playsInline muted autoPlay />
                    <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full transform -scale-x-100" />
                </div>

                {/* Status Bar */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center space-x-4 bg-black/50 backdrop-blur-sm px-6 py-2 rounded-full border border-gray-700/50 z-20">
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' :
                            connectionStatus === 'reconnecting' ? 'bg-yellow-500 animate-pulse' :
                                connectionStatus === 'failed' ? 'bg-red-500' : 'bg-gray-500'
                            }`}></span>
                        <span className="text-lg font-semibold">{status}</span>
                    </div>
                    <div className="w-px h-6 bg-gray-600"></div>
                    <div className="text-lg font-mono">{timer}</div>
                    {connectionStatus === 'failed' && (
                        <Button
                            type="primary"
                            danger
                            size="small"
                            onClick={connectWebSocket}
                            className="ml-2 animate-bounce"
                        >
                            재연결 시도
                        </Button>
                    )}
                </div>

                {/* Controls */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center space-x-4 bg-black/50 backdrop-blur-sm p-3 rounded-full border border-gray-700/50 z-20 pointer-events-auto">
                    <Button
                        type="text"
                        shape="circle"
                        icon={<CameraOutlined style={{ fontSize: '24px', color: 'white' }} />}
                        onClick={toggleCamera}
                        className="hover:bg-blue-500/20"
                    />
                    <Button
                        type="text"
                        shape="circle"
                        icon={isPaused ? <PlayCircleOutlined style={{ fontSize: '24px', color: 'white' }} /> : <PauseCircleOutlined style={{ fontSize: '24px', color: 'white' }} />}
                        onClick={togglePause}
                        className="hover:bg-blue-500/20"
                    />
                </div>
            </div>

            {/* Camera Toggle Button (Visible when camera is hidden) */}
            {!isCameraVisible && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
                    <Button
                        type="primary"
                        shape="round"
                        size="large"
                        icon={<CameraOutlined />}
                        onClick={toggleCamera}
                        className="bg-blue-600 hover:bg-blue-500 h-12 px-8 text-lg"
                    >
                        카메라 켜기
                    </Button>
                </div>
            )}
        </div>
    );
};

export default SessionPage;
