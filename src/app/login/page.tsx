'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, CheckSquare, Loader2, Check } from 'lucide-react'
import { LOGO_URL } from '@/lib/brand'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
      })

      const data = await res.json()

      if (!res.ok) {
        const errorText = data.message ? `${data.error} (${data.message})` : (data.error || 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน')
        setError(errorText)
        return
      }

      router.push('/overview')
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-2/5 xl:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 flex-col justify-between p-10 relative overflow-hidden">
        {/* Background circles */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full opacity-30 -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-500 rounded-full opacity-20 translate-y-24 -translate-x-24" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-md p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO_URL} alt="DEMS logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-white font-bold text-2xl tracking-wide">DEMS</span>
          </div>

          <h1 className="text-white text-3xl font-bold leading-tight mb-3">
            ระบบพนักงานรายวัน
          </h1>
          <p className="text-blue-100 text-base leading-relaxed max-w-xs">
            จัดการข้อมูลพนักงาน กะการทำงาน และ Namelist รายวันได้ในที่เดียว ครบทุกคลัง
          </p>
        </div>

        {/* Features */}
        <div className="relative z-10 space-y-3">
          {[
            'รองรับ 6 คลังทั่วประเทศ',
            'ติดตาม Namelist และค่าจ้างแบบเรียลไทม์',
            'ควบคุมสิทธิ์การเข้าถึงตาม Role',
          ].map((feat) => (
            <div key={feat} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-400 bg-opacity-40 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <span className="text-blue-50 text-sm">{feat}</span>
            </div>
          ))}
          <p className="text-blue-300 text-xs mt-4">© 2026 People One Co., Ltd.</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_URL} alt="DEMS logo" className="w-9 h-9 object-contain" />
            <span className="font-bold text-xl text-blue-600">DEMS</span>
          </div>

          {/* Login card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-gray-900">เข้าสู่ระบบ</h2>
              <p className="text-gray-500 text-sm mt-1">
                กรอกอีเมลและรหัสผ่านของคุณเพื่อเข้าใช้งาน
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label htmlFor="email" className="label">
                  อีเมล
                </label>
                <input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@peopleone.co.th"
                  className="input"
                  required
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="label">
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input pr-10"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0',
                    rememberMe
                      ? 'bg-[#7C3AED] border-[#7C3AED]'
                      : 'border-gray-300 group-hover:border-[#7C3AED] bg-white'
                  )}
                >
                  {rememberMe && (
                    <Check size={11} strokeWidth={3.5} className="text-white" />
                  )}
                </div>
                <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                  จดจำฉันไว้ในระบบ
                </span>
              </label>

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-3 text-base font-semibold rounded-xl"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    กำลังเข้าสู่ระบบ...
                  </>
                ) : (
                  'เข้าสู่ระบบ'
                )}
              </button>
            </form>

            <p className="text-center text-gray-400 text-xs mt-6">
              © 2026 People One Co., Ltd.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
