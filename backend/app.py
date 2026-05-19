from flask import Flask, request, jsonify, send_from_directory, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3, os, re, json, urllib.request, urllib.error, urllib.parse
from datetime import datetime

app = Flask(__name__, static_folder=None)
app.secret_key = 'iqra-ai-secret-change-in-production'
CORS(app, supports_credentials=True)

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DB_PATH = os.path.join(os.path.dirname(__file__), 'iqra.db')

API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "openai/gpt-4o-mini"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL DEFAULT 'New Chat',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );
    ''')
    conn.commit()
    conn.close()

init_db()

SYSTEM_PROMPT = 'You are Iqra AI, an Islamic AI assistant for Tanzanian students. Speak in the language the user uses: English, Kiswahili, or Arabic. Answer concisely in 2-4 sentences. When citing verses, MUST display the exact Quranic Arabic text in Uthmani script with surah name and ayah number. Use the Arabic text from context. Greetings: Wa Alaikum Assalaam / Salam Alaykum.'

SURAH_NAMES = {
    'al-fatiha':1, 'alfatiha':1, 'fatiha':1, 'al fatiha':1, 'الفاتحة':1,
    'al-baqarah':2, 'albaqarah':2, 'baqarah':2, 'baqara':2, 'البقرة':2,
    'al-imran':3, 'ali imran':3, 'imran':3, 'آل عمران':3,
    'an-nisa':4, 'annisa':4, 'nisa':4, 'النساء':4,
    'al-maidah':5, 'almaidah':5, 'maidah':5, 'المائدة':5,
    'al-anam':6, 'alanam':6, 'anam':6, 'الأنعام':6,
    'al-araf':7, 'alaraf':7, 'araf':7, 'الأعراف':7,
    'al-anfal':8, 'alanfal':8, 'anfal':8, 'الأنفال':8,
    'at-tawbah':9, 'attawbah':9, 'tawbah':9, 'taubah':9, 'التوبة':9,
    'yusuf':12, 'يوسف':12,
    'maryam':19, 'مريم':19,
    'ta-ha':20, 'taha':20, 'طه':20,
    'ya-sin':36, 'yasin':36, 'يس':36,
    'ar-rahman':55, 'arrahman':55, 'rahman':55, 'الرحمن':55,
    'al-waqiah':56, 'alwaqiah':56, 'waqiah':56, 'الواقعة':56,
    'al-mulk':67, 'almulk':67, 'mulk':67, 'الملك':67,
    'al-kahf':18, 'alkahf':18, 'kahf':18, 'الكهف':18,
    'muhammad':47, 'محمد':47,
    'al-fath':48, 'alfath':48, 'fath':48, 'الفتح':48,
    'al-hujurat':49, 'alhujurat':49, 'hujurat':49, 'الحجرات':49,
    'qaf':50, 'ق':50,
    'ad-dhariyat':51, 'addhariyat':51, 'dhariyat':51, 'الذاريات':51,
    'at-tur':52, 'attur':52, 'tur':52, 'الطور':52,
    'an-najm':53, 'annajm':53, 'najm':53, 'النجم':53,
    'al-qamar':54, 'alqamar':54, 'qamar':54, 'القمر':54,
    'al-hadid':57, 'alhadid':57, 'hadid':57, 'الحديد':57,
    'al-mujadilah':58, 'almujadilah':58, 'mujadilah':58, 'المجادلة':58,
    'al-hashr':59, 'alhashr':59, 'hashr':59, 'الحشر':59,
    'al-mumtahanah':60, 'almumtahanah':60, 'mumtahanah':60, 'الممتحنة':60,
    'as-saff':61, 'assaff':61, 'saff':61, 'الصف':61,
    'al-jumuah':62, 'aljumuah':62, 'jumuah':62, 'الجمعة':62,
    'al-munafiqun':63, 'almunafiqun':63, 'munafiqun':63, 'المنافقون':63,
    'at-taghabun':64, 'attaghabun':64, 'taghabun':64, 'التغابن':64,
    'at-talaq':65, 'attalaq':65, 'talaq':65, 'الطلاق':65,
    'at-tahrim':66, 'attahrim':66, 'tahrim':66, 'التحريم':66,
    'al-insan':76, 'alinsan':76, 'insan':76, 'الإنسان':76,
    'al-mursalat':77, 'almursalat':77, 'mursalat':77, 'المرسلات':77,
    'an-naba':78, 'annaba':78, 'naba':78, 'النبأ':78,
    'an-naziat':79, 'annaziat':79, 'naziat':79, 'النازعات':79,
    'abasa':80, 'عبس':80,
    'at-takwir':81, 'attakwir':81, 'takwir':81, 'التكوير':81,
    'al-infitar':82, 'alinfitar':82, 'infitar':82, 'الإنفطار':82,
    'al-mutaffifin':83, 'almutaffifin':83, 'mutaffifin':83, 'المطففين':83,
    'al-inshiqaq':84, 'alinshiqaq':84, 'inshiqaq':84, 'الإنشقاق':84,
    'al-buruj':85, 'alburuj':85, 'buruj':85, 'البروج':85,
    'at-tariq':86, 'attariq':86, 'tariq':86, 'الطارق':86,
    'al-ala':87, 'alala':87, 'ala':87, 'الأعلى':87,
    'al-ghashiyah':88, 'alghashiyah':88, 'ghashiyah':88, 'الغاشية':88,
    'al-fajr':89, 'alfajr':89, 'fajr':89, 'الفجر':89,
    'al-balad':90, 'albalad':90, 'balad':90, 'البلد':90,
    'ash-shams':91, 'ashshams':91, 'shams':91, 'الشمس':91,
    'al-layl':92, 'allayl':92, 'layl':92, 'الليل':92,
    'ad-duha':93, 'adduha':93, 'duha':93, 'الضحى':93,
    'ash-sharh':94, 'ashsharh':94, 'sharh':94, 'الشرح':94, 'inshirah':94,
    'at-tin':95, 'attin':95, 'tin':95, 'التين':95,
    'al-alaq':96, 'alalaq':96, 'alaq':96, 'العلق':96,
    'al-qadr':97, 'alqadr':97, 'qadr':97, 'القدر':97,
    'al-bayyinah':98, 'albayyinah':98, 'bayyinah':98, 'البينة':98,
    'az-zalzalah':99, 'azzalzalah':99, 'zalzalah':99, 'الزلزلة':99,
    'al-adiyat':100, 'aladiyat':100, 'adiyat':100, 'العاديات':100,
    'al-qariah':101, 'alqariah':101, 'qariah':101, 'القارعة':101,
    'at-takathur':102, 'attakathur':102, 'takathur':102, 'التكاثر':102,
    'al-asr':103, 'alasr':103, 'asr':103, 'العصر':103,
    'al-humazah':104, 'alhumazah':104, 'humazah':104, 'الهمزة':104,
    'al-fil':105, 'alfil':105, 'fil':105, 'الفيل':105,
    'quraysh':106, 'قريش':106,
    'al-maun':107, 'almaun':107, 'maun':107, 'الماعون':107,
    'al-kawthar':108, 'alkawthar':108, 'kawthar':108, 'الكوثر':108,
    'al-kafirun':109, 'alkafirun':109, 'kafirun':109, 'الكافرون':109,
    'an-nasr':110, 'annasr':110, 'nasr':110, 'النصر':110,
    'al-masad':111, 'almasad':111, 'masad':111, 'المسد':111, 'tabbat':111, 'lahab':111,
    'al-ikhlas':112, 'alikhlas':112, 'ikhlas':112, 'الإخلاص':112,
    'al-falaq':113, 'alfalaq':113, 'falaq':113, 'الفلق':113,
    'an-nas':114, 'annas':114, 'nas':114, 'الناس':114,
}

def fetch_ayah_arabic(surah, ayah):
    try:
        url = f"https://api.alquran.cloud/v1/ayah/{surah}:{ayah}/quran-uthmani"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
        if data.get('code') == 200:
            return data['data']['text']
    except:
        pass
    return ''

def fetch_surah_info(surah_num):
    try:
        url = f"https://api.alquran.cloud/v1/surah/{surah_num}/quran-uthmani"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read())
        if data.get('code') == 200:
            s = data['data']
            lines = [f"{i+1}. {a['text']}" for i, a in enumerate(s['ayahs'])]
            return f"{s['englishName']} ({s['name']}) - {s['numberOfAyahs']} ayahs\n" + '\n'.join(lines)
    except:
        pass
    return ''

def extract_ayah_ref(text):
    import re as re_mod
    m = re_mod.search(r'(?:surah|sura|surat|s:)?\s*(\d+)\s*[:\s]\s*(\d+)(?:\s|$|\.|\,)', text)
    if m:
        return int(m.group(1)), int(m.group(2))
    m = re_mod.search(r'(?:ayah|ayat|aya|verse)\s*(\d+)', text)
    if m:
        return None, int(m.group(1))
    return None, None

def search_quran_verses(query):
    q = query.strip().lower()

    s_num, a_num = extract_ayah_ref(q)

    import re as re_mod
    surah_keywords = r'\b(?:surah|sura|surat)\s+(\d+)\b'
    sk_match = re_mod.search(surah_keywords, q)
    if sk_match and a_num is None:
        s_num = int(sk_match.group(1))

    if s_num and a_num:
        arabic = fetch_ayah_arabic(s_num, a_num)
        if arabic:
            try:
                url = f"https://api.alquran.cloud/v1/ayah/{s_num}:{a_num}/en.sahih"
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    en_data = json.loads(resp.read())
                english = en_data.get('data', {}).get('text', '') if en_data.get('code') == 200 else ''
            except:
                english = ''
            try:
                url2 = f"https://api.alquran.cloud/v1/surah/{s_num}"
                req2 = urllib.request.Request(url2, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req2, timeout=5) as resp2:
                    s_data = json.loads(resp2.read())
                s_name = s_data.get('data', {}).get('englishName', f'Surah {s_num}')
            except:
                s_name = f'Surah {s_num}'
            result = f"Surah {s_name} ({s_num}:{a_num})\n{arabic}"
            if english:
                result += f'\n{english}'
            result += f'\nhttps://quran.com/{s_num}/{a_num}'
            return result

    surah_num = None
    words = set(re_mod.sub(r'[^\w\s]', ' ', q).split())
    for name, num in sorted(SURAH_NAMES.items(), key=lambda x: -len(x[0])):
        name_clean = name.replace('-', '').replace(' ', '')
        if name_clean in words or name in q.replace('-', ' '):
            surah_num = num
            break
    if surah_num and a_num is None:
        surah_info = fetch_surah_info(surah_num)
        if surah_info:
            return surah_info

    try:
        encoded = urllib.parse.quote(query)
        url = f"https://api.alquran.cloud/v1/search/{encoded}/all/en.sahih"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read())
        if data.get('code') == 200 and data.get('data', {}).get('matches'):
            matches = data['data']['matches'][:3]
            results = []
            for m in matches:
                s_n = m.get('surah', {}).get('number', '?')
                a_n = m.get('ayah', {}).get('numberInSurah', '?')
                s_name = m.get('surah', {}).get('englishName', 'Unknown')
                english = m.get('text', '')
                arabic = fetch_ayah_arabic(s_n, a_n)
                if arabic:
                    results.append(f"Surah {s_name} ({s_n}:{a_n})\n{arabic}")
                    if english:
                        results.append(english)
                else:
                    results.append(f"Surah {s_name} ({s_n}:{a_n})\n{english}")
            return '\n\n'.join(results) if results else ''
    except:
        return ''

def get_ai_response(message, conversation_history=None):
    quran_context = search_quran_verses(message)

    system = SYSTEM_PROMPT
    if quran_context:
        system = SYSTEM_PROMPT + '\n\nQURAN VERSES:\n' + quran_context

    messages = [{"role": "system", "content": system}]
    if conversation_history:
        for msg in conversation_history[-4:]:
            messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": message})

    payload = json.dumps({
        "model": MODEL,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 3000
    }).encode()

    req = urllib.request.Request(OPENROUTER_URL, data=payload,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {API_KEY}',
            'HTTP-Referer': 'http://localhost:5000',
            'X-Title': 'Iqra AI'
        })

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            return result['choices'][0]['message']['content']
    except urllib.error.HTTPError as e:
        return f"As-salaam Alaikum! I'm having trouble connecting to my knowledge base. Please try again later."
    except Exception:
        return get_fallback_response(message)

def get_fallback_response(message):
    msg = message.strip().lower()
    if any(w in msg for w in ["salam", "peace"]):
        return "Wa Alaikum Assalaam! Peace be upon you. How can I assist you with Islamic knowledge today?"
    if any(w in msg for w in ["hello", "hi", "hey", "hujambo", "habari"]):
        return "Salam Alaykum! Welcome to Iqra AI. How can I help you today?"
    return "Salam Alaykum! I'm here to help with Islamic knowledge. Please ask me about Quran, Hadith, prayer, or any topic you need guidance on."

PROPHETS = [
    {"id":1,"name":"Adam","arabic":"آدم","meaning":"Baba wa Binadamu"},
    {"id":2,"name":"Idris","arabic":"إدريس","meaning":"Mwalimu wa Kwanza"},
    {"id":3,"name":"Nuh","arabic":"نوح","meaning":"Mwana wa Jamaa"},
    {"id":4,"name":"Hud","arabic":"هود","meaning":"Mkombozi"},
    {"id":5,"name":"Salih","arabic":"صالح","meaning":"Mwema"},
    {"id":6,"name":"Ibrahim","arabic":"إبراهيم","meaning":"Rafiki wa Mwenyezi Mungu"},
    {"id":7,"name":"Ismail","arabic":"إسماعيل","meaning":"Mwenye Kusikia Mwenyezi Mungu"},
    {"id":8,"name":"Ishaq & Yaqub","arabic":"إسحاق ويعقوب","meaning":"Mababa wa Waisraeli"},
    {"id":9,"name":"Lut","arabic":"لوط","meaning":"Mlinzi"},
    {"id":10,"name":"Shuaib","arabic":"شعيب","meaning":"Mwongozaji"},
    {"id":11,"name":"Yusuf","arabic":"يوسف","meaning":"Mwenye Nguvu"},
    {"id":12,"name":"Ayyub","arabic":"أيوب","meaning":"Mwenye Subira"},
    {"id":13,"name":"Dhul-Kifl","arabic":"ذو الكفل","meaning":"Mwenye Ahadi"},
    {"id":16,"name":"Yunus","arabic":"يونس","meaning":"Mwenye Njiwa"},
    {"id":17,"name":"Musa","arabic":"موسى","meaning":"Aliyekuwa Mtoto"},
    {"id":18,"name":"Hisqeel","arabic":"حزقيل","meaning":"Mwenye Nguvu za Mwenyezi Mungu"},
    {"id":19,"name":"Ilyas","arabic":"إلياس","meaning":"Mwenye Nguvu za Mwenyezi Mungu"},
    {"id":20,"name":"Shammil","arabic":"شاميل","meaning":"Aliyesikiwa na Mwenyezi Mungu"},
    {"id":21,"name":"Dawud","arabic":"داود","meaning":"Mpendwa"},
    {"id":22,"name":"Sulaiman","arabic":"سليمان","meaning":"Mwenye Amani"},
    {"id":23,"name":"Isaiah","arabic":"إشعياء","meaning":"Wokovu wa Mwenyezi Mungu"},
    {"id":24,"name":"Aramaya","arabic":"أرميا","meaning":"Mwenye Kuinuliwa na Mwenyezi Mungu"},
    {"id":25,"name":"Daniyal","arabic":"دانيال","meaning":"Mwenye Haki ya Mwenyezi Mungu"},
    {"id":26,"name":"Uzair","arabic":"عزير","meaning":"Msaidizi"},
    {"id":27,"name":"Zakariya","arabic":"زكريا","meaning":"Mwenye Kukumbuka Mwenyezi Mungu"},
    {"id":28,"name":"Yahya","arabic":"يحيى","meaning":"Mwenye Uhai"},
    {"id":29,"name":"Isa","arabic":"عيسى","meaning":"Masiya"},
    {"id":30,"name":"Muhammad","arabic":"محمد","meaning":"Aliye Sifiwa"},
]

@app.route('/api/prophets', methods=['GET'])
def get_prophets():
    return jsonify({'prophets': PROPHETS})

@app.route('/api/prophets/<int:prophet_id>/story', methods=['GET'])
def get_prophet_story(prophet_id):
    prophet = next((p for p in PROPHETS if p['id'] == prophet_id), None)
    if not prophet:
        return jsonify({'error': 'Prophet not found'}), 404
    try:
        url = f"https://alim.org/history/prophet-stories/{prophet_id}/"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8', errors='replace')
        title_match = re.search(r'<h1[^>]*>(.*?)</h1>', html, re.DOTALL)
        title = title_match.group(1).strip() if title_match else prophet['name']
        story_text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
        story_text = re.sub(r'<style[^>]*>.*?</style>', '', story_text, flags=re.DOTALL)
        story_text = re.sub(r'<nav[^>]*>.*?</nav>', '', story_text, flags=re.DOTALL)
        story_text = re.sub(r'<footer[^>]*>.*?</footer>', '', story_text, flags=re.DOTALL)
        story_text = re.sub(r'<header[^>]*>.*?</header>', '', story_text, flags=re.DOTALL)
        story_text = re.sub(r'<[^>]+>', '\n', story_text)
        lines = [l.strip() for l in story_text.split('\n')]
        lines = [l for l in lines if l and len(l) > 3]
        story_text = '\n\n'.join(lines)
        start_markers = ['Allah the Almighty', 'Prophet', 'Informing', 'Purpose and History']
        end_markers = ['Loading Comments', 'Support Our Initiatives', 'Related Islamic Resources']
        start = 0
        for m in start_markers:
            idx = story_text.find(m)
            if idx != -1:
                start = idx
                break
        end = len(story_text)
        for m in end_markers:
            idx = story_text.find(m, start)
            if idx != -1:
                end = idx
                break
        story_text = story_text[start:end].strip()
        return jsonify({
            'prophet': prophet,
            'title': title,
            'content': story_text
        })
    except Exception as e:
        return jsonify({'error': f'Failed to fetch story: {str(e)}', 'prophet': prophet}), 500

@app.route('/')
def serve_index():
    return send_from_directory(FRONTEND_DIR, 'login.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(FRONTEND_DIR, filename)

@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    if not username or not email or not password:
        return jsonify({'error': 'All fields are required'}), 400
    if len(password) < 4:
        return jsonify({'error': 'Password must be at least 4 characters'}), 400
    conn = get_db()
    try:
        conn.execute('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
                     (username, email, generate_password_hash(password)))
        conn.commit()
        user = conn.execute('SELECT id, username, email FROM users WHERE email = ?', (email,)).fetchone()
        session['user_id'] = user['id']
        session['username'] = user['username']
        return jsonify({'user': {'id': user['id'], 'username': user['username'], 'email': user['email']}})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username or email already exists'}), 409
    finally:
        conn.close()

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    conn.close()
    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'error': 'Invalid email or password'}), 401
    session['user_id'] = user['id']
    session['username'] = user['username']
    return jsonify({'user': {'id': user['id'], 'username': user['username'], 'email': user['email']}})

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out'})

@app.route('/api/auth/me', methods=['GET'])
def get_me():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    conn = get_db()
    user = conn.execute('SELECT id, username, email FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    conn.close()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'user': {'id': user['id'], 'username': user['username'], 'email': user['email']}})

@app.route('/api/auth/profile', methods=['PUT'])
def update_profile():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    data = request.get_json()
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    if not username or not email:
        return jsonify({'error': 'Username and email are required'}), 400
    conn = get_db()
    try:
        conn.execute('UPDATE users SET username = ?, email = ? WHERE id = ?',
                     (username, email, session['user_id']))
        conn.commit()
        session['username'] = username
        return jsonify({'user': {'id': session['user_id'], 'username': username, 'email': email}})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username or email already exists'}), 409
    finally:
        conn.close()

@app.route('/api/auth/password', methods=['PUT'])
def change_password():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    data = request.get_json()
    current = data.get('current_password', '')
    new_pw = data.get('new_password', '')
    if not current or not new_pw:
        return jsonify({'error': 'Current and new password are required'}), 400
    if len(new_pw) < 4:
        return jsonify({'error': 'New password must be at least 4 characters'}), 400
    conn = get_db()
    user = conn.execute('SELECT password_hash FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    if not user or not check_password_hash(user['password_hash'], current):
        conn.close()
        return jsonify({'error': 'Current password is incorrect'}), 401
    conn.execute('UPDATE users SET password_hash = ? WHERE id = ?',
                 (generate_password_hash(new_pw), session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Password updated successfully'})

@app.route('/api/conversations', methods=['GET'])
def get_conversations():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    conn = get_db()
    rows = conn.execute(
        'SELECT id, title, created_at, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC',
        (session['user_id'],)
    ).fetchall()
    conn.close()
    return jsonify({'conversations': [dict(r) for r in rows]})

@app.route('/api/conversations', methods=['POST'])
def create_conversation():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    data = request.get_json() or {}
    title = data.get('title', 'New Chat')
    conn = get_db()
    cur = conn.execute('INSERT INTO conversations (user_id, title) VALUES (?, ?)',
                       (session['user_id'], title))
    conn.commit()
    row = conn.execute('SELECT * FROM conversations WHERE id = ?', (cur.lastrowid,)).fetchone()
    conn.close()
    return jsonify({'conversation': dict(row)}), 201

@app.route('/api/conversations/<int:conv_id>', methods=['DELETE'])
def delete_conversation(conv_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    conn = get_db()
    conn.execute('DELETE FROM conversations WHERE id = ? AND user_id = ?', (conv_id, session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Deleted'})

@app.route('/api/conversations/<int:conv_id>/messages', methods=['GET'])
def get_messages(conv_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    conn = get_db()
    conv = conn.execute('SELECT id FROM conversations WHERE id = ? AND user_id = ?',
                        (conv_id, session['user_id'])).fetchone()
    if not conv:
        conn.close()
        return jsonify({'error': 'Not found'}), 404
    rows = conn.execute('SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at',
                        (conv_id,)).fetchall()
    conn.close()
    return jsonify({'messages': [dict(r) for r in rows]})

@app.route('/api/chat', methods=['POST'])
def chat():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    data = request.get_json()
    if not data or 'message' not in data:
        return jsonify({'error': 'Message is required'}), 400

    message = data['message'].strip()
    conv_id = data.get('conversation_id')
    if not message:
        return jsonify({'response': 'Please type a message.'})

    conn = get_db()
    history = []
    if conv_id:
        rows = conn.execute(
            'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at',
            (conv_id,)
        ).fetchall()
        history = [dict(r) for r in rows]

    if not conv_id:
        title = message[:50] + ('...' if len(message) > 50 else '')
        cur = conn.execute('INSERT INTO conversations (user_id, title) VALUES (?, ?)',
                          (session['user_id'], title))
        conv_id = cur.lastrowid

    response = get_ai_response(message, history)
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    conn.execute('INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)',
                (conv_id, 'user', message, now))
    conn.execute('INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)',
                (conv_id, 'assistant', response, now))
    conn.execute('UPDATE conversations SET updated_at = ? WHERE id = ?', (now, conv_id))
    conn.commit()
    conn.close()

    return jsonify({'response': response, 'conversation_id': conv_id})

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'Iqra AI backend is running!'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
