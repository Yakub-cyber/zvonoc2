import { useEffect, useRef, useState } from 'react'
import { createSignaling } from './lib/signaling'

const ICE_SERVERS = [
	{ urls: 'stun:stun.l.google.com:19302' },
	{ urls: 'stun:global.stun.twilio.com:3478?transport=udp' },
]

export default function App() {
	const [room, setRoom] = useState(
		new URLSearchParams(location.search).get('room') || ''
	)
	const [joined, setJoined] = useState(false)
	const [muted, setMuted] = useState(false)
	const [status, setStatus] = useState('idle')
	const localRef = useRef(null)
	const remoteRef = useRef(null)
	const pcRef = useRef(null)
	const sigRef = useRef(null)
	const localStreamRef = useRef(null)

	useEffect(
		() => () => {
			sigRef.current?.close()
			pcRef.current?.close()
			localStreamRef.current?.getTracks().forEach(t => t.stop())
		},
		[]
	)

	async function join() {
		if (!room) {
			alert('Введите Room ID')
			return
		}
		setStatus('Запрашиваю микрофон...')
		const stream = await navigator.mediaDevices.getUserMedia({
			audio: true,
			video: false,
		})
		localStreamRef.current = stream
		if (localRef.current) localRef.current.srcObject = stream

		setStatus('Подключаю сигналинг...')
		const signalingURL = import.meta.env.VITE_SIGNALING_URL
		if (!signalingURL) {
			alert('Не задан VITE_SIGNALING_URL')
			return
		}
		const sig = createSignaling(signalingURL, room)
		sigRef.current = sig
		await sig.ready()

		setStatus('Создаю RTCPeerConnection...')
		const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
		pcRef.current = pc

		// входящий удалённый звук
		pc.ontrack = e => {
			if (remoteRef.current && e.streams[0])
				remoteRef.current.srcObject = e.streams[0]
		}
		// отправляем ICE кандидаты
		pc.onicecandidate = e => {
			if (e.candidate) sig.send({ type: 'candidate', candidate: e.candidate })
		}

		// добавляем свой аудио‑трек
		stream.getTracks().forEach(t => pc.addTrack(t, stream))

		// обработка сигналинга
		sig.on(async msg => {
			if (msg.type === 'offer') {
				await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
				const answer = await pc.createAnswer()
				await pc.setLocalDescription(answer)
				sig.send({ type: 'answer', sdp: pc.localDescription })
			} else if (msg.type === 'answer') {
				await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
			} else if (msg.type === 'candidate') {
				try {
					await pc.addIceCandidate(msg.candidate)
				} catch {}
			} else if (msg.type === 'leave') {
				pc.close()
				setJoined(false)
				setStatus('Партнёр вышел')
			}
		})

		// создаём оффер как «первый»
		const offer = await pc.createOffer({
			offerToReceiveAudio: true,
			offerToReceiveVideo: false,
		})
		await pc.setLocalDescription(offer)
		sig.send({ type: 'offer', sdp: pc.localDescription })

		setJoined(true)
		setStatus('Подключено')
	}

	function leave() {
		sigRef.current?.send({ type: 'leave' })
		sigRef.current?.close()
		pcRef.current?.close()
		localStreamRef.current?.getTracks().forEach(t => t.stop())
		setJoined(false)
		setStatus('Отключено')
	}

	function toggleMute() {
		const track = localStreamRef.current?.getAudioTracks()[0]
		if (!track) return
		track.enabled = !track.enabled
		setMuted(!track.enabled)
	}

	console.log('SIGNALING:', import.meta.env.VITE_SIGNALING_URL)

	return (
		<div className='container'>
			<div className='card'>
				<h2>🔊 WebRTC Аудиозвонок (без видео)</h2>
				<p className='small'>
					Зайдите с двух устройств в одну и ту же комнату (Room ID).
				</p>

				<div className='row' style={{ alignItems: 'center', marginTop: 8 }}>
					<input
						placeholder='Room ID'
						value={room}
						onChange={e => setRoom(e.target.value)}
					/>
					{!joined ? (
						<button className='primary' onClick={join}>
							Подключиться
						</button>
					) : (
						<button onClick={leave}>Отключиться</button>
					)}
					<span className='badge'>{status}</span>
				</div>

				<div className='controls'>
					<button onClick={toggleMute}>
						{muted ? 'Включить микрофон' : 'Выключить микрофон'}
					</button>
				</div>

				<div style={{ marginTop: 14 }}>
					<div>🎤 Вы (локально):</div>
					<audio ref={localRef} autoPlay muted playsInline></audio>
				</div>
				<div style={{ marginTop: 14 }}>
					<div>👥 Собеседник:</div>
					<audio ref={remoteRef} autoPlay playsInline></audio>
				</div>
			</div>
		</div>
	)
}
