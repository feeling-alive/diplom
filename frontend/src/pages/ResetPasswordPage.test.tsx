import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ResetPasswordPage from './ResetPasswordPage'

const apiResetPassword = vi.fn()
vi.mock('../lib/authApi', () => ({
  apiResetPassword: (...args: unknown[]) => apiResetPassword(...args),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/reset-password']}>
      <ResetPasswordPage />
    </MemoryRouter>,
  )
}

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

describe('ResetPasswordPage (code flow)', () => {
  beforeEach(() => apiResetPassword.mockReset())

  it('renders email, code and password fields', () => {
    renderPage()
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Код из письма/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Новый пароль/i)).toBeInTheDocument()
  })

  it('submits email + 6-digit code + new password', async () => {
    apiResetPassword.mockResolvedValue({ message: 'ok' })
    renderPage()
    fill(/Email/i, 'user@example.com')
    fill(/Код из письма/i, '123456')
    fill(/Новый пароль/i, 'brandnew456')
    fill(/Повторите пароль/i, 'brandnew456')
    fireEvent.click(screen.getByRole('button', { name: /Сменить пароль/i }))

    await waitFor(() =>
      expect(apiResetPassword).toHaveBeenCalledWith('user@example.com', '123456', 'brandnew456'),
    )
  })

  it('blocks submit when passwords do not match', async () => {
    renderPage()
    fill(/Email/i, 'user@example.com')
    fill(/Код из письма/i, '123456')
    fill(/Новый пароль/i, 'brandnew456')
    fill(/Повторите пароль/i, 'different999')
    fireEvent.click(screen.getByRole('button', { name: /Сменить пароль/i }))

    expect(await screen.findByText(/Пароли не совпадают/i)).toBeInTheDocument()
    expect(apiResetPassword).not.toHaveBeenCalled()
  })

  it('rejects a non-6-digit code without calling the API', async () => {
    renderPage()
    fill(/Email/i, 'user@example.com')
    fill(/Код из письма/i, '12') // input strips non-digits but stays too short
    fill(/Новый пароль/i, 'brandnew456')
    fill(/Повторите пароль/i, 'brandnew456')
    fireEvent.click(screen.getByRole('button', { name: /Сменить пароль/i }))

    expect(await screen.findByText(/Код состоит из 6 цифр/i)).toBeInTheDocument()
    expect(apiResetPassword).not.toHaveBeenCalled()
  })
})
