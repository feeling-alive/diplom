PS C:\Users\Никита\Desktop\DIPLOM\dashboard-app\backend>   $env:DATABASE_URL="postgresql+asyncpg://fintrack:fintrack_pass@localhost:5433/fintrack"
>>   .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
INFO:     Will watch for changes in these directories: ['C:\\Users\\Никита\\Desktop\\DIPLOM\\dashboard-app\\backend']
2026-06-04 04:20:05,774 INFO backend.main [main] auth/users/subscription/dashboard/news routes mounted
2026-06-04 04:20:05,775 INFO backend.main [main] static /uploads mounted from uploads
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [16116] using WatchFiles
2026-06-04 04:20:08,063 INFO backend.main [main] auth/users/subscription/dashboard/news routes mounted
2026-06-04 04:20:08,064 INFO backend.main [main] static /uploads mounted from uploads
INFO:     Started server process [43828]
INFO:     Waiting for application startup.
2026-06-04 04:20:08,067 INFO backend.config [config] redis_url=redis://localhost:6379 finnhub_key=present cors=['http://localhost:5173'] ttls(stock/crypto/forex)=60/30/300
2026-06-04 04:20:08,067 INFO backend.config [config] database_url=postgresql+asyncpg://fintrack:***@localhost:5433/fintrack secret_key=present algorithm=HS256 token_ttl_min=10080 uploads_dir=uploads
2026-06-04 04:20:08,067 INFO backend.config [config] google_client_id=present google_client_secret=present backend_url=http://localhost:8000 frontend_url=http://localhost:5173
2026-06-04 04:20:08,067 INFO backend.main [main] creating tables via metadata.create_all (dev)
2026-06-04 04:20:08,230 INFO backend.main [main] tables ready: ['users', 'subscriptions', 'dashboard_configs', 'chat_sessions', 'comments', 'favorites', 'news_articles', 'news_reactions', 'news_favorites']
2026-06-04 04:20:08,230 INFO backend.main [main] startup — routes mounted at /api/quotes
2026-06-04 04:20:08,246 INFO apscheduler.scheduler Adding job tentatively -- it will be properly scheduled when the scheduler starts
2026-06-04 04:20:08,247 INFO apscheduler.scheduler Added job "fetch_and_store_news" to job store "default"
2026-06-04 04:20:08,248 INFO apscheduler.scheduler Scheduler started
2026-06-04 04:20:08,248 INFO backend.main [main] APScheduler started — news fetch every 4 h
INFO:     Application startup complete.
2026-06-04 04:20:08,249 INFO apscheduler.executors.default Running job "fetch_and_store_news (trigger: interval[4:00:00], next run at: 2026-06-04 08:20:08 MSK)" (scheduled at 2026-06-04 04:20:08.244508+03:00)
2026-06-04 04:20:08,249 INFO backend.news_fetcher [news_fetcher] fetch started
2026-06-04 04:20:09,411 INFO httpx HTTP Request: GET https://newsapi.org/v2/everything?q=bitcoin+OR+ethereum+OR+crypto&pageSize=30&apiKey=24fbf0cdc3fa4f36b671950d44eb270f&language=en "HTTP/1.1 200 OK"
2026-06-04 04:20:09,412 INFO httpx HTTP Request: GET https://newsapi.org/v2/everything?q=stocks+OR+earnings+OR+S%26P500&pageSize=30&apiKey=24fbf0cdc3fa4f36b671950d44eb270f&language=en "HTTP/1.1 200 OK"
2026-06-04 04:20:09,573 INFO httpx HTTP Request: GET https://newsapi.org/v2/everything?q=finance+OR+economy+OR+market&pageSize=30&apiKey=24fbf0cdc3fa4f36b671950d44eb270f&language=en "HTTP/1.1 200 OK"
2026-06-04 04:20:09,918 INFO httpx HTTP Request: GET https://newsapi.org/v2/everything?q=forex+OR+dollar+OR+euro+OR+Fed&pageSize=30&apiKey=24fbf0cdc3fa4f36b671950d44eb270f&language=en "HTTP/1.1 200 OK"
2026-06-04 04:20:10,088 INFO backend.news_fetcher [news_fetcher] inserted 0 new articles
2026-06-04 04:20:10,090 INFO apscheduler.executors.default Job "fetch_and_store_news (trigger: interval[4:00:00], next run at: 2026-06-04 08:20:08 MSK)" executed successfully
INFO:     Shutting down
INFO:     Waiting for application shutdown.
2026-06-04 04:20:49,633 INFO backend.main [main] shutdown
2026-06-04 04:20:49,633 INFO apscheduler.scheduler Scheduler has been shut down
INFO:     Application shutdown complete.
INFO:     Finished server process [43828]
INFO:     Stopping reloader process [16116]