import React, { useEffect, useRef, useState } from 'react'
import { motion } from "motion/react"
import { FiCheckCircle, FiLoader, FiAlertCircle } from "react-icons/fi"
import { useDispatch } from 'react-redux'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { serverUrl } from '../App'
import { setUserData } from '../redux/userSlice'

function PaymentSuccess() {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const [status, setStatus] = useState('verifying') // 'verifying' | 'success' | 'error'
    const [message, setMessage] = useState('')
    const hasVerified = useRef(false)

    useEffect(() => {
        const verify = async () => {
            // Prevent duplicate calls in StrictMode
            if (hasVerified.current) return
            hasVerified.current = true

            const sessionId = searchParams.get('session_id')

            if (!sessionId) {
                setStatus('error')
                setMessage('Payment session not found. Please refresh your credits on the home page.')
                setTimeout(() => navigate('/'), 5000)
                return
            }

            try {
                const result = await axios.post(
                    serverUrl + '/api/credit/verify-payment',
                    { sessionId },
                    { withCredentials: true }
                )

                // Update user data in Redux store with the fresh data from server
                dispatch(setUserData(result.data.user))
                setStatus('success')
                setTimeout(() => navigate('/'), 3000)

            } catch (error) {
                const errMsg = error?.response?.data?.message || 'Verification failed'
                setStatus('error')
                setMessage(errMsg)
                setTimeout(() => navigate('/'), 5000)
            }
        }

        verify()
    }, [])

    return (
        <div className='min-h-screen flex flex-col items-center justify-center p-4 gap-4'>
            <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`text-6xl ${status === 'error' ? 'text-orange-400' : 'text-green-500'}`}>
                {status === 'error' ? <FiAlertCircle /> : <FiCheckCircle />}
            </motion.div>

            <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={`text-2xl font-bold ${status === 'error' ? 'text-orange-500' : 'text-green-600'}`}>
                {status === 'verifying' ? 'Processing Payment...' :
                 status === 'success' ? 'Payment Successful! Credits Added ✅' :
                 'Payment Received'}
            </motion.h1>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex flex-col items-center gap-2 text-center max-w-md"
            >
                {status === 'verifying' && (
                    <div className="flex items-center gap-2 text-gray-500 text-sm animate-pulse">
                        <FiLoader className="animate-spin" />
                        <span>Verifying your payment and adding credits...</span>
                    </div>
                )}
                {status === 'success' && (
                    <p className="text-gray-500 text-sm">Redirecting to home...</p>
                )}
                {status === 'error' && (
                    <p className="text-gray-500 text-sm">{message}<br />Redirecting to home...</p>
                )}
            </motion.div>
        </div>
    )
}

export default PaymentSuccess
