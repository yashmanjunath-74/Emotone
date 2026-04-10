import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import FloatingBackground from './FloatingBackground'
import DraggableEmoji from './DraggableEmoji'
import AudioVisualizer from './AudioVisualizer'
import AnimatedLoader from './AnimatedLoader'

const API_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/predict'

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

function mixToMono(buffer) {
  if (buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0)
  }

  const length = buffer.length
  const mono = new Float32Array(length)
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      mono[i] += data[i]
    }
  }

  for (let i = 0; i < length; i++) {
    mono[i] /= buffer.numberOfChannels
  }

  return mono
}

async function resampleToTarget(buffer, targetSampleRate) {
  if (buffer.sampleRate === targetSampleRate) {
    return buffer
  }

  const OfflineContextClass =
    window.OfflineAudioContext || window.webkitOfflineAudioContext
  const length = Math.ceil(buffer.duration * targetSampleRate)
  const offlineContext = new OfflineContextClass(
    buffer.numberOfChannels,
    length,
    targetSampleRate
  )
  const source = offlineContext.createBufferSource()
  source.buffer = buffer
  source.connect(offlineContext.destination)
  source.start(0)

  return await offlineContext.startRendering()
}

function audioBufferToWav(buffer) {
  const numChannels = 1
  const sampleRate = buffer.sampleRate
  const format = 1
  const bitDepth = 16

  const data = mixToMono(buffer)
  const bufferArray = new ArrayBuffer(44 + data.length * 2)
  const view = new DataView(bufferArray)

  /* RIFF identifier */ writeString(view, 0, 'RIFF')
  /* file length */ view.setUint32(4, 36 + data.length * 2, true)
  /* RIFF type */ writeString(view, 8, 'WAVE')
  /* format chunk identifier */ writeString(view, 12, 'fmt ')
  /* format chunk length */ view.setUint32(16, 16, true)
  /* sample format (raw) */ view.setUint16(20, format, true)
  /* channel count */ view.setUint16(22, numChannels, true)
  /* sample rate */ view.setUint32(24, sampleRate, true)
  /* byte rate */ view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true)
  /* block align */ view.setUint16(32, numChannels * (bitDepth / 8), true)
  /* bits per sample */ view.setUint16(34, bitDepth, true)
  /* data chunk identifier */ writeString(view, 36, 'data')
  /* data chunk length */ view.setUint32(40, data.length * 2, true)

  let offset = 44
  for (let i = 0; i < data.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, data[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }

  return new Blob([view], { type: 'audio/wav' })
}

function AudioPredictor() {
  const [file, setFile] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [emotion, setEmotion] = useState(null)
  const [confidence, setConfidence] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  useEffect(() => {
    return () => {
      // Clean up the object URL to avoid memory leaks when component unmounts
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        audioChunksRef.current = []

        try {
          const arrayBuffer = await audioBlob.arrayBuffer()
          const AudioContextClass = window.AudioContext || window.webkitAudioContext
          const audioContext = new AudioContextClass()

          const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer)
          const resampledBuffer = await resampleToTarget(decodedBuffer, 16000)
          const wavBlob = audioBufferToWav(resampledBuffer)
          const recordedFile = new File([wavBlob], 'recording.wav', { type: 'audio/wav' })

          setFile(recordedFile)

          if (audioUrl) {
            URL.revokeObjectURL(audioUrl)
          }
          setAudioUrl(URL.createObjectURL(recordedFile))

          setEmotion(null)
          setConfidence(null)
          setError('')
          await audioContext.close()
        } catch (err) {
          console.error('Failed to convert recording:', err)
          setError('Failed to process recording, please try again.')
        }
      }

      audioChunksRef.current = []
      mediaRecorderRef.current.start()
      setIsRecording(true)
      setError('')
      setFile(null)
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
        setAudioUrl(null)
      }
    } catch (err) {
      console.error('Error accessing microphone:', err)
      setError('Could not access microphone. Please check permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
      setIsRecording(false)
    }
  }

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0] ?? null
    setFile(selected)
    setEmotion(null)
    setConfidence(null)
    setError('')
    
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
    if (selected) {
      setAudioUrl(URL.createObjectURL(selected))
    } else {
      setAudioUrl(null)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!file) {
      setError('Please choose a .wav or .mp3 file, or record audio before submitting.')
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    setLoading(true)
    setError('')

    try {
      const response = await axios.post(API_URL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setEmotion(response.data?.emotion ?? 'unknown')
      setConfidence(response.data?.confidence ?? null)
    } catch (err) {
      setError('Unable to analyze the audio. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const confidenceLabel =
    typeof confidence === 'number'
      ? `${(confidence * 100).toFixed(1)}%`
      : null

  const confidencePercent =
    typeof confidence === 'number'
      ? Math.min(Math.max(confidence * 100, 0), 100)
      : 0

  const normalizedEmotion = typeof emotion === 'string' ? emotion : ''
  const emotionKey = normalizedEmotion.toLowerCase()

  const emotionTheme = {
    happy: {
      card: 'border-emerald-200 bg-emerald-50/70 text-emerald-900',
      bar: 'bg-emerald-500',
      badge: 'bg-emerald-100 text-emerald-700',
    },
    angry: {
      card: 'border-rose-200 bg-rose-50/70 text-rose-900',
      bar: 'bg-rose-500',
      badge: 'bg-rose-100 text-rose-700',
    },
    sad: {
      card: 'border-sky-200 bg-sky-50/70 text-sky-900',
      bar: 'bg-sky-500',
      badge: 'bg-sky-100 text-sky-700',
    },
    neutral: {
      card: 'border-slate-200 bg-slate-50/70 text-slate-900',
      bar: 'bg-slate-500',
      badge: 'bg-slate-200 text-slate-700',
    },
    surprise: {
      card: 'border-amber-200 bg-amber-50/70 text-amber-900',
      bar: 'bg-amber-500',
      badge: 'bg-amber-100 text-amber-700',
    },
    fear: {
      card: 'border-violet-200 bg-violet-50/70 text-violet-900',
      bar: 'bg-violet-500',
      badge: 'bg-violet-100 text-violet-700',
    },
    disgust: {
      card: 'border-lime-200 bg-lime-50/70 text-lime-900',
      bar: 'bg-lime-500',
      badge: 'bg-lime-100 text-lime-700',
    },
  }

  const theme = emotionTheme[emotionKey] ?? {
    card: 'border-slate-200 bg-white/70 text-slate-900',
    bar: 'bg-slate-600',
    badge: 'bg-slate-100 text-slate-700',
  }

  return (
    <>
      <FloatingBackground emotionKey={emotionKey} />
      <DraggableEmoji emotionKey={emotionKey} />
      <section className="relative z-10 rounded-3xl border border-white/20 bg-white/60 p-6 shadow-glass backdrop-blur-xl md:p-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col gap-3">
          <label className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Upload or Record Audio
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/60 p-4 justify-center">
              <input
                type="file"
                accept=".wav,audio/wav,.mp3,audio/mpeg,audio/mp3,.webm,audio/webm,.ogg,audio/ogg,.m4a,audio/mp4"
                onChange={handleFileChange}
                disabled={isRecording}
                className="file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white file:shadow-sm hover:file:bg-slate-800 disabled:opacity-50"
              />
              <p className="text-sm text-slate-500">
                Supports .wav, .mp3, .webm, .ogg and .m4a.
              </p>
            </div>
            <div className="flex flex-col sm:w-48 gap-3 rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/60 p-4 items-center justify-center">
              {isRecording ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex items-center justify-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-600 w-full"
                >
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                  </span>
                  Stop Recording
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 w-full transition-transform hover:scale-105"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                  </svg>
                  Start Recording
                </button>
              )}
              {isRecording && (
                <span className="text-xs text-rose-500 animate-pulse font-semibold">Recording in progress...</span>
              )}
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-80 min-w-[200px] flex justify-center items-center"
          >
            {loading ? <AnimatedLoader /> : 'Detect emotion'}
          </button>
          
          {file ? (
            <div className="flex flex-1 flex-col justify-center gap-2 sm:flex-row sm:items-center sm:justify-start">
              <span className="text-sm text-slate-600 truncate max-w-[200px]" title={file.name}>
                {file.name}
              </span>
              {audioUrl && (
                <div className="flex flex-col w-full max-w-[250px] gap-2">
                  <audio 
                    controls 
                    src={audioUrl} 
                    className="h-10 w-full outline-none" 
                    controlsList="nodownload noplaybackrate"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                  />
                  <div className="block md:hidden">
                    <AudioVisualizer isPlaying={isPlaying} colorClass={theme.bar || "bg-slate-500"} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <span className="text-sm text-slate-500">No file selected.</span>
          )}
        </div>
      </form>

      <div className="w-full mt-6 hidden md:block">
        {file && <AudioVisualizer isPlaying={isPlaying} colorClass={theme.bar || "bg-slate-500"} />}
      </div>

      <div
        className={`mt-8 grid gap-4 rounded-2xl border p-5 transition backdrop-blur-sm shadow-sm ${theme.card}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Result
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${loading ? 'bg-slate-200 text-slate-500 animate-pulse' : theme.badge}`}
          >
            {loading ? 'Processing' : (confidenceLabel ?? 'Awaiting audio')}
          </span>
        </div>

        <div className="flex flex-wrap items-baseline gap-3">
          <span className={`text-3xl font-semibold ${loading ? 'animate-pulse text-slate-400' : ''}`}>
            {loading ? 'Listening...' : (emotion ?? '—')}
          </span>
          <span className="text-sm text-slate-500">Confidence</span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-white/70">
          <div
            className={`h-full ${theme.bar}`}
            style={{ width: `${confidencePercent}%` }}
          />
        </div>
      </div>
    </section>
    </>
  )
}

export default AudioPredictor
