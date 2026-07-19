import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * §7.2: lokální živý přepis (Web Speech API), NE cloudový Whisper — nulový
 * náklad na síť/API během diktování, AI krok se volá zvlášť a jen na
 * vyžádání (viz VoiceRecorderModal.tsx). Chrome/Edge podporují nativně,
 * Firefox/starší Safari ne — `isSupported` na to appka reaguje viditelně,
 * ne tichým selháním.
 */
export function useSpeechRecognition() {
  const [isSupported] = useState(
    () => typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  )
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const finalTranscriptRef = useRef('')

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
    }
  }, [])

  const start = useCallback(() => {
    if (!isSupported) {
      setError('Rozpoznávání řeči není v tomhle prohlížeči podporované.')
      return
    }
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SpeechRecognitionCtor) return

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'cs-CZ'
    recognition.continuous = true
    recognition.interimResults = true

    finalTranscriptRef.current = ''
    setTranscript('')
    setError(null)

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results.item(i)
        const text = result.item(0).transcript
        if (result.isFinal) {
          finalTranscriptRef.current += `${text} `
        } else {
          interim += text
        }
      }
      setTranscript(`${finalTranscriptRef.current}${interim}`.trim())
    }

    recognition.onerror = (event) => {
      setError(`Nahrávání selhalo (${event.error}).`)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isSupported])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  const reset = useCallback(() => {
    finalTranscriptRef.current = ''
    setTranscript('')
    setError(null)
  }, [])

  return { isSupported, isListening, transcript, setTranscript, error, start, stop, reset }
}
