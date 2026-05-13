import React from 'react';
import { Link } from 'react-router-dom';

export default function ProfilePage() {
  return (
    <main>
      <header>
        <h1>Навигация</h1>
        <nav>
          <ul>
            <li><Link to="/">Дашборд</Link></li>
            <li><Link to="/charts">Графики</Link></li>
            <li><Link to="/news">Новости</Link></li>
            <li><Link to="/chat">Чат с ИИ</Link></li>
            <li><Link to="/logout">Выйти</Link></li>
          </ul>
        </nav>
      </header>

      <article>
        <header>
          <h2>Профиль пользователя</h2>
        </header>

        {/* 2. Основная информация (Profile Overview) */}
        <section>
          <h3>Основная информация</h3>
          <img src="https://via.placeholder.com/150" alt="Аватар пользователя" />
          <p>Никнейм: <strong>User123</strong></p>
          <p>ID: <strong>#987654321</strong></p>
          <p>Статус подписки: <strong>Бесплатный</strong></p>
        </section>

        <hr />

        {/* 3. Форма редактирования профиля */}
        <section>
          <h3>Редактирование профиля</h3>
          <form action="#" method="POST" encType="multipart/form-data">
            <div>
              <label htmlFor="avatar">Аватар (изображение):</label>
              <input type="file" id="avatar" name="avatar" accept="image/*" />
            </div>
            
            <div>
              <label htmlFor="background">Фоновое изображение:</label>
              <input type="file" id="background" name="background" accept="image/*" />
            </div>

            <div>
              <label htmlFor="nickname">Отображаемый никнейм:</label>
              <input type="text" id="nickname" name="nickname" placeholder="Введите новый никнейм" required />
            </div>

            <button type="submit">Сохранить изменения</button>
          </form>
        </section>

        <hr />

        {/* 4. Управление подпиской и лимитами */}
        <section>
          <h3>Управление подпиской и лимитами</h3>
          <p>Ваш текущий уровень доступа: <em>Базовый</em></p>
          <p>Остаток запросов к ИИ: <strong>3 из 5</strong> (на сегодня)</p>
          <form action="/upgrade" method="GET">
            <button type="submit">Перейти к оплате Премиум-доступа</button>
          </form>
        </section>

        <hr />

        {/* 5. Настройки персонализации (Dashboard Settings) */}
        <aside>
          <h3>Настройки дашборда и мониторинга</h3>
          
          <section>
            <h4>Активные виджеты</h4>
            <table>
              <thead>
                <tr>
                  <th>Название виджета</th>
                  <th>Тип</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>График BTC</td>
                  <td>Криптовалюта</td>
                  <td><button type="button">Удалить</button></td>
                </tr>
                <tr>
                  <td>Новости NASDAQ</td>
                  <td>Новости</td>
                  <td><button type="button">Удалить</button></td>
                </tr>
                <tr>
                  <td>Мой Портфель</td>
                  <td>Сводка</td>
                  <td><button type="button">Удалить</button></td>
                </tr>
              </tbody>
            </table>
            <button type="button">Добавить виджет</button>
          </section>

          <section>
            <h4>Отслеживаемые активы (Watchlist)</h4>
            <ul>
              <li>
                Apple Inc. (AAPL) <button type="button">Удалить</button>
              </li>
              <li>
                Ethereum (ETH) <button type="button">Удалить</button>
              </li>
            </ul>
            <form action="#" method="POST">
              <label htmlFor="new-asset">Добавить актив:</label>
              <input type="text" id="new-asset" name="new-asset" placeholder="Тикер актива (напр. TSLA)" required />
              <button type="submit">Добавить в список</button>
            </form>
          </section>
        </aside>

        <hr />

        {/* 6. История взаимодействия с ИИ */}
        <section>
          <h3>История взаимодействия с ИИ</h3>
          <ul>
            <li>
              <strong>Прогноз по TSLA на неделю</strong> — <time dateTime="2026-05-13">13 мая 2026</time>
            </li>
            <li>
              <strong>Анализ отчета Microsoft</strong> — <time dateTime="2026-05-10">10 мая 2026</time>
            </li>
          </ul>
        </section>

        <hr />

        {/* 7. Безопасность и аккаунт */}
        <section>
          <h3>Безопасность и аккаунт</h3>
          <form action="#" method="POST">
            <div>
              <label htmlFor="old-password">Старый пароль:</label>
              <input type="password" id="old-password" name="old-password" placeholder="Введите старый пароль" required />
            </div>
            
            <div>
              <label htmlFor="new-password">Новый пароль:</label>
              <input type="password" id="new-password" name="new-password" placeholder="Введите новый пароль" required />
            </div>

            <div>
              <label htmlFor="confirm-password">Подтверждение нового пароля:</label>
              <input type="password" id="confirm-password" name="confirm-password" placeholder="Повторите новый пароль" required />
            </div>

            <div>
              <input type="checkbox" id="volatility-alerts" name="volatility-alerts" defaultChecked />
              <label htmlFor="volatility-alerts">Получать уведомления о сильной волатильности активов</label>
            </div>

            <button type="submit">Обновить настройки безопасности</button>
          </form>
        </section>

      </article>
    </main>
  );
}
