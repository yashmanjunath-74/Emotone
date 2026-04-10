import AudioPredictor from './components/AudioPredictor.jsx'

function App() {
  return (
    <div className="min-h-screen px-6 py-10 md:px-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="space-y-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">
            EmoTone Studio
          </p>
          <h1 className="text-4xl font-semibold text-slate-900 md:text-5xl">
            Hear the emotion behind every voice sample.
          </h1>
          <p className="max-w-2xl text-lg text-slate-600">
            Upload a .wav file and our model will estimate the dominant emotion
            with a confidence score in seconds.
          </p>
        </header>

        <AudioPredictor />
      </div>
    </div>
  )
}

export default App
