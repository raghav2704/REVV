from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import select
from app.models import UserSession
from app.routes import auth
from conftest import PASSWORD, headers, photo


@pytest.mark.parametrize('path,payload',[
 ('/api/v1/auth/login',{'email':'buyer@example.com','password':PASSWORD}),
 ('/api/v1/auth/register',{'full_name':'Fictional Intruder','email':'csrf@example.com','password':PASSWORD}),
 ('/api/v1/auth/logout',None),
])
@pytest.mark.parametrize('origin',['https://attacker.example','null'])
def test_auth_csrf_denied(client,path,payload,origin):
    assert client.post(path,headers=headers('buyer',origin),json=payload).status_code==403


def test_login_bruteforce_limited(client):
    statuses=[client.post('/api/v1/auth/login',headers=headers(),json={'email':'missing@example.com','password':PASSWORD}).status_code for _ in range(11)]
    assert statuses[:10]==[401]*10
    assert statuses[10]==429


def test_registration_limited(client):
    statuses=[client.post('/api/v1/auth/register',headers=headers(),json={'full_name':'Fictional Test','email':f'new{i}@example.com','password':PASSWORD}).status_code for i in range(6)]
    assert statuses[:5]==[201]*5
    assert statuses[5]==429


def test_validation_never_echoes_password(client):
    secret='DO-NOT-ECHO-THIS-PASSWORD'
    response=client.post('/api/v1/auth/register',headers=headers(),json={'full_name':'Test','email':'invalid','password':secret})
    assert response.status_code==422
    assert secret not in response.text
    # Trigger password's own validation, which included raw input before hardening.
    response=client.post('/api/v1/auth/register',headers=headers(),json={'full_name':'Test','email':'test@example.com','password':secret})
    assert response.status_code==422 and secret not in response.text


def test_login_logout_session_contract(client,db):
    response=client.post('/api/v1/auth/login',headers=headers(),json={'email':'buyer@example.com','password':PASSWORD})
    assert response.status_code==200
    cookie=response.headers['set-cookie'].lower()
    assert 'httponly' in cookie and 'samesite=lax' in cookie
    token=client.cookies.get('revv_session')
    assert token and len(token)>=64
    stored=db.scalar(select(UserSession).where(UserSession.token_hash==auth.hash_token(token)))
    assert stored and stored.token_hash!=token
    assert client.get('/api/v1/auth/me').json()['id']==2
    assert client.post('/api/v1/auth/logout',headers=headers()).status_code==200
    assert client.get('/api/v1/auth/me',headers={'Cookie':f'revv_session={token}'}).status_code==401


def test_expired_and_forged_sessions_denied(client,db):
    db.add(UserSession(user_id=2,token_hash=auth.hash_token('expired-test'),expires_at=datetime.now(timezone.utc)-timedelta(days=1)))
    db.commit()
    for token in ['expired-test','forged-session']:
        assert client.get('/api/v1/auth/me',headers={'Cookie':f'revv_session={token}'}).status_code==401


@pytest.mark.parametrize('body,mime',[(b'<svg onload="alert(1)"/>','image/png'),(b'not an image','image/jpeg')])
def test_malicious_upload_denied(client,body,mime):
    assert client.post('/api/v1/cars/2/images',headers=headers('seller'),files={'files':('photo.jpg',body,mime)}).status_code==400


def test_valid_image_is_reencoded_and_private(client):
    response=client.post('/api/v1/cars/2/images',headers=headers('seller'),files={'files':('../../bad.html',photo(),'text/html')})
    assert response.status_code==201
    url=response.json()['images'][0]['url']
    assert url.endswith('.jpg') and '..' not in url and 'html' not in url
    assert client.get(url).status_code==404
    assert client.get(url,headers=headers('seller')).headers['content-type']=='image/jpeg'


def test_unsafe_write_origin_and_cors(client):
    assert client.patch('/api/v1/cars/2',headers=headers('seller','https://evil.example'),json={'price_nzd':30000}).status_code==403
    assert 'access-control-allow-origin' not in client.get('/health',headers={'Origin':'https://evil.example'}).headers
    assert client.get('/health',headers=headers()).headers['access-control-allow-origin']=='http://127.0.0.1:3001'


def test_all_unsafe_origins_missing_null_and_lookalike_denied(client):
    for extra in [{}, {'Origin':'null'}, {'Origin':'http://127.0.0.1:3001.attacker.example'}, {'Origin':'http://127.0.0.1:3001','Sec-Fetch-Site':'same-origin'}]:
        expected=200 if extra.get('Origin')=='http://127.0.0.1:3001' else 403
        assert client.post('/api/v1/auth/logout',headers=extra).status_code==expected
    assert client.post('/api/v1/auth/logout',headers={'Referer':'http://127.0.0.1:3001/login'}).status_code==200


def test_request_size_limits_declared_and_streamed(client):
    response=client.post('/api/v1/auth/login',headers={**headers(),'Content-Length':'70000'},content=b'{}')
    assert response.status_code==413
    response=client.post('/api/v1/auth/login',headers={**headers(),'Content-Type':'application/json'},content=iter([b'x'*40000,b'y'*40000]))
    assert response.status_code==413
    response=client.post('/api/v1/cars/2/images',headers={**headers('seller'),'Content-Length':str(53*1024*1024)},content=b'')
    assert response.status_code==413


def test_image_byte_and_dimension_limits(client):
    response=client.post('/api/v1/cars/2/images',headers=headers('seller'),files={'files':('test.png',b'x'*(5*1024*1024+1),'image/png')})
    assert response.status_code==413
    import struct,zlib
    data=bytearray(photo())
    data[16:24]=struct.pack('>II',5001,5001)
    data[29:33]=struct.pack('>I',zlib.crc32(data[12:29]) & 0xffffffff)
    assert client.post('/api/v1/cars/2/images',headers=headers('seller'),files={'files':('huge.png',bytes(data),'image/png')}).status_code==400


def test_image_metadata_and_appended_payload_stripped(client):
    import io
    from PIL import Image
    stream=io.BytesIO();exif=Image.Exif();exif[270]='PRIVATE_EXIF_TEST'
    Image.new('RGB',(10,10),'red').save(stream,'JPEG',exif=exif)
    raw=stream.getvalue()+b'<script>POLYGLOT_PAYLOAD_TEST</script>'
    response=client.post('/api/v1/cars/2/images',headers=headers('seller'),files={'files':('bad.jpg',raw,'image/jpeg')})
    assert response.status_code==201
    output=client.get(response.json()['images'][0]['url'],headers=headers('seller')).content
    assert b'PRIVATE_EXIF_TEST' not in output and b'POLYGLOT_PAYLOAD_TEST' not in output
    assert not Image.open(io.BytesIO(output)).getexif()


def test_message_and_both_offer_limits(client,db):
    from sqlalchemy import text
    for _ in range(10):
        db.execute(text("INSERT INTO messages(conversation_id,sender_id,body) VALUES (1,1,'rate test')"))
    for actor in [1,2]:
        for _ in range(5):
            db.execute(text("INSERT INTO vehicle_offer_events(offer_id,actor_id,action,amount_nzd) VALUES (1,:actor,'counter',21000)"),{'actor':actor})
    db.commit()
    assert client.post('/api/v1/messages/conversations/1/messages',headers=headers('seller'),json={'message':'new'}).status_code==429
    assert client.post('/api/v1/deals/vehicles/3/offers',headers=headers('buyer'),json={'amount_nzd':20000}).status_code==429
    response=client.post('/api/v1/deals/offers/1/respond',headers=headers('seller'),json={'action':'counter','amount_nzd':22000})
    assert response.status_code==429 and response.headers['retry-after']=='60'


def test_sql_and_html_payloads_are_stored_as_text(client,db):
    from sqlalchemy import text
    payload="<script>alert('x')</script>'); DROP TABLE users; --"
    response=client.post('/api/v1/messages/conversations/1/messages',headers=headers('buyer'),json={'message':payload})
    assert response.status_code==201 and response.json()['body']==payload
    assert db.execute(text('SELECT COUNT(*) FROM users')).scalar_one()==4
    assert client.get('/api/v1/cars/1%20OR%201=1').status_code==422


def test_production_configuration_fails_closed():
    import os,subprocess,sys
    env=dict(os.environ,REVV_ENV='production',REVV_ALLOWED_ORIGINS='https://revv.example',REVV_ALLOWED_HOSTS='api.revv.example',REVV_RATE_LIMIT_PATH='/tmp/revv-test-limits.sqlite3')
    env.pop('REVV_COOKIE_SECURE',None)
    result=subprocess.run([sys.executable,'-c','from app.security import COOKIE_SECURE; assert COOKIE_SECURE'],env=env,capture_output=True)
    assert result.returncode==0
    for changes in [{'REVV_COOKIE_SECURE':'false'},{'REVV_ALLOWED_ORIGINS':'*'},{'REVV_ALLOWED_ORIGINS':'http://revv.example'},{'REVV_ALLOWED_HOSTS':'*'}]:
        result=subprocess.run([sys.executable,'-c','import app.security'],env={**env,**changes},capture_output=True)
        assert result.returncode!=0


def test_auth_limiter_atomic_private_and_fail_closed(client,tmp_path,monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    from fastapi import HTTPException
    from starlette.requests import Request
    from app.security import auth_rate_limit
    request=Request({'type':'http','method':'POST','path':'/','headers':[],'client':('192.0.2.1',123)})
    def attempt(_):
        try: auth_rate_limit(request,'atomic_test',10,60,identity='fictional@example.com');return 200
        except HTTPException as error:return error.status_code
    with ThreadPoolExecutor(max_workers=5) as pool:
        statuses=list(pool.map(attempt,range(20)))
    assert statuses.count(200)==10 and statuses.count(429)==10
    path=tmp_path/'limits.sqlite3'
    assert path.stat().st_mode & 0o777==0o600
    assert b'fictional@example.com' not in path.read_bytes()
    monkeypatch.setenv('REVV_RATE_LIMIT_PATH','/dev/null/invalid/limits.sqlite3')
    assert client.post('/api/v1/auth/login',headers=headers(),json={'email':'buyer@example.com','password':PASSWORD}).status_code==503


def test_security_headers_and_photo_traversal(client):
    response=client.get('/api/v1/auth/me',headers=headers('buyer'))
    assert response.headers['cache-control']=='private, no-store'
    assert response.headers['x-content-type-options']=='nosniff'
    assert response.headers['x-frame-options']=='DENY'
    for name in ['not-a-generated-file.jpg','a'*32+'.svg','a'*32+'.jpg%00','%2e%2e%2fsecret']:
        assert client.get('/uploads/vehicles/'+name,headers=headers('admin')).status_code==404


@pytest.mark.parametrize("format_name,mime", [("JPEG","image/jpeg"),("PNG","image/png"),("WEBP","image/webp")])
def test_supported_decoders_only(client,format_name,mime):
    import io,sys
    from PIL import Image
    stream=io.BytesIO()
    Image.new("RGB",(20,20),"navy").save(stream,format_name)
    response=client.post('/api/v1/cars/2/images',headers=headers('seller'),files={'files':('photo',stream.getvalue(),mime)})
    assert response.status_code==201
    assert 'PIL.AvifImagePlugin' not in sys.modules


def test_photo_id_cannot_be_used_under_another_owned_vehicle(client,db):
    from sqlalchemy import text
    assert client.delete('/api/v1/cars/3/images/1',headers=headers('outsider')).status_code==404
    assert client.patch('/api/v1/cars/3/images/1/cover',headers=headers('outsider')).status_code==404
    assert db.execute(text('SELECT vehicle_id FROM vehicle_images WHERE id=1')).scalar_one()==2



def test_secure_cookie_flag_when_enabled(client,monkeypatch):
    monkeypatch.setattr(auth,'COOKIE_SECURE',True)
    response=client.post('/api/v1/auth/login',headers=headers(),json={'email':'buyer@example.com','password':PASSWORD})
    assert response.status_code==200
    assert '; secure' in response.headers['set-cookie'].lower()


def test_production_database_configuration_is_restricted():
    import os,subprocess,sys
    env=dict(os.environ,REVV_ENV='production',REVV_COOKIE_SECURE='true',REVV_ALLOWED_ORIGINS='https://revv.example',REVV_ALLOWED_HOSTS='api.revv.example',REVV_RATE_LIMIT_PATH='/tmp/revv-test-limits.sqlite3')
    for url in ['postgresql+psycopg://revv@db.example/revv','']:
        result=subprocess.run([sys.executable,'-c','import app.database'],env={**env,'DATABASE_URL':url},capture_output=True)
        assert result.returncode!=0
    code="""
from app.database import reject_privileged_runtime_role
class Connection:
    def __init__(self, privileged): self.privileged=privileged
    def cursor(self): return self
    def __enter__(self): return self
    def __exit__(self,*args): pass
    def execute(self,sql): assert 'rolsuper OR rolcreatedb OR rolcreaterole' in sql
    def fetchone(self): return (self.privileged,)
reject_privileged_runtime_role(Connection(False),None)
try: reject_privileged_runtime_role(Connection(True),None)
except RuntimeError: pass
else: raise AssertionError('Privileged role accepted')
"""
    result=subprocess.run([sys.executable,'-c',code],env={**env,'DATABASE_URL':'postgresql+psycopg://revv@db.example/revv?sslmode=verify-full'},capture_output=True)
    assert result.returncode==0


def test_denials_have_security_headers(client):
    response=client.post('/api/v1/auth/logout',headers={'Origin':'https://evil.example'})
    assert response.status_code==403
    assert response.headers['x-content-type-options']=='nosniff'



def test_reauthentication_rotates_presented_session(client,db):
    from conftest import TOKENS
    response=client.post('/api/v1/auth/login',headers=headers('buyer'),json={'email':'buyer@example.com','password':PASSWORD})
    assert response.status_code==200
    assert client.cookies.get('revv_session') != TOKENS['buyer']
    assert client.get('/api/v1/auth/me',headers={'Cookie':f"revv_session={TOKENS['buyer']}"}).status_code==401
    assert client.get('/api/v1/auth/me').status_code==200
    # A login must not revoke another account's unrelated session.
    assert client.get('/api/v1/auth/me',headers=headers('seller')).status_code==200
