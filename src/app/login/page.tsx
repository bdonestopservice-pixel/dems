'use client'

import { useState, useEffect } from 'react'
import { Eye, EyeOff, Loader2, Check, Mail, Lock, ArrowRight } from 'lucide-react'
import { LOGO_URL } from '@/lib/brand'
import { cn } from '@/lib/utils'
import styles from './login.module.css'

const REMEMBER_EMAIL_KEY = 'dems_remembered_email'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // เติมอีเมลที่เคยจดจำไว้
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(REMEMBER_EMAIL_KEY)
      if (saved) {
        setEmail(saved)
        setRememberMe(true)
      }
    } catch {}
  }, [])

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
        const errorText = data.message
          ? `${data.error} (${data.message})`
          : data.error || 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน'
        setError(errorText)
        return
      }

      // จดจำอีเมลไว้เติมให้อัตโนมัติครั้งถัดไป (ไม่เก็บรหัสผ่าน — ให้ Password Manager ของเบราว์เซอร์จัดการ)
      try {
        if (rememberMe) {
          window.localStorage.setItem(REMEMBER_EMAIL_KEY, email)
        } else {
          window.localStorage.removeItem(REMEMBER_EMAIL_KEY)
        }
      } catch {}

      // ใช้ full navigation เพื่อให้เบราว์เซอร์เสนอบันทึกรหัสผ่าน และแน่ใจว่าคุกกี้ถูกส่งไปกับคำขอถัดไป
      window.location.assign('/overview')
      return
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      {/* Left Brand Panel */}
      <aside className={styles.leftPanel}>
        {/* Decorative Background Shapes */}
        <div className={styles.shapesLayer} aria-hidden="true">
          <div className={cn(styles.rectCard, styles.rectCard1)} />
          <div className={cn(styles.rectCard, styles.rectCard2)} />
          <div className={cn(styles.rectCard, styles.rectCard3)} />
          <div className={styles.circleOuter} />
          <div className={styles.circleInner} />
        </div>

        {/* Top-left Glass Logo Badge */}
        <div className={styles.logoBadgeWrap}>
          <div className={styles.logoBadge}>
            <div className={styles.logoTile}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO_URL} alt="DEMS logo" className={styles.logoImg} />
            </div>
            <span className={styles.logoText}>DEMS</span>
          </div>
        </div>

        {/* Center Hero Copy */}
        <div className={styles.heroBlock}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowLine} />
            <span>DAILY EMPLOYEE MANAGEMENT</span>
          </div>

          <h1 className={styles.heroTitle}>
            ระบบพนักงาน<span className={styles.heroTitleHighlight}>รายวัน</span>
          </h1>

          <p className={styles.heroSubtitle}>
            จัดการพนักงาน กะการทำงาน และ Namelist ได้ในที่เดียว
          </p>
        </div>

        {/* Bottom-left Brand Footer */}
        <div className={styles.leftFooter}>People One Co., Ltd.</div>
      </aside>

      {/* Right Form Panel */}
      <main className={styles.rightPanel}>
        {/* Mobile Logo Header */}
        <div className={styles.mobileBrand}>
          <div className={styles.mobileLogoTile}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_URL} alt="DEMS logo" className={styles.logoImg} />
          </div>
          <span className={styles.mobileBrandText}>DEMS</span>
        </div>

        {/* Login Card */}
        <div className={styles.card}>
          <div className={styles.cardTopBar} />

          <div className={styles.cardBody}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>ยินดีต้อนรับกลับมา</h2>
              <p className={styles.cardSubtitle}>เข้าสู่ระบบเพื่อเริ่มใช้งาน</p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              {/* Email */}
              <div className={styles.fieldGroup}>
                <label htmlFor="email" className={styles.fieldLabel}>
                  อีเมล
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIconLeft} aria-hidden="true">
                    <Mail size={16} strokeWidth={1.85} />
                  </span>
                  <input
                    id="email"
                    name="username"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@peopleone.co.th"
                    className={styles.inputField}
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password */}
              <div className={styles.fieldGroup}>
                <label htmlFor="password" className={styles.fieldLabel}>
                  รหัสผ่าน
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIconLeft} aria-hidden="true">
                    <Lock size={16} strokeWidth={1.85} />
                  </span>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่าน"
                    className={cn(styles.inputField, styles.inputFieldPassword)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={styles.eyeBtn}
                    aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} strokeWidth={1.85} /> : <Eye size={16} strokeWidth={1.85} />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <label className={styles.rememberRow}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    styles.checkboxBox,
                    rememberMe && styles.checkboxBoxChecked
                  )}
                >
                  {rememberMe && <Check size={11} strokeWidth={3.5} className="text-white" />}
                </span>
                <span className={styles.rememberText}>จดจำฉันไว้ในระบบ</span>
              </label>

              {/* Error */}
              {error && <div className={styles.errorBox}>{error}</div>}

              {/* Submit Button */}
              <button type="submit" disabled={loading} className={styles.submitBtn}>
                {loading ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    <span>กำลังเข้าสู่ระบบ...</span>
                  </>
                ) : (
                  <>
                    <span>เข้าสู่ระบบ</span>
                    <ArrowRight size={16} strokeWidth={2.2} className={styles.submitArrow} />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
