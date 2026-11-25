import pytest
from sqlalchemy import select, text
from app.models import User, Vehicle
from conftest import headers, photo


@pytest.mark.parametrize("who,expected", [(None,401),("outsider",403)])
@pytest.mark.parametrize("method,path,body", [
    ("PATCH","/api/v1/cars/2", {"price_nzd":1}),
    ("DELETE","/api/v1/cars/2",None),
    ("DELETE","/api/v1/cars/2/images/1",None),
    ("PATCH","/api/v1/cars/2/images/1/cover",None),
    ("PUT","/api/v1/cars/2/images/order",{"image_ids":[1]}),
])
def test_foreign_listing_mutations_denied(client,db,who,expected,method,path,body):
    response=client.request(method,path,headers=headers(who),json=body)
    assert response.status_code==expected
    assert db.get(Vehicle,2).price_nzd==25000
    assert db.get(Vehicle,2).owner_id==1
    assert db.execute(text("SELECT COUNT(*) FROM vehicle_images WHERE id=1")).scalar_one()==1


@pytest.mark.parametrize("who,expected", [(None,401),("outsider",403)])
def test_foreign_photo_upload_denied(client,who,expected):
    assert client.post('/api/v1/cars/2/images',headers=headers(who),files={'files':('test.png',photo(),'image/png')}).status_code==expected


@pytest.mark.parametrize('path',['/api/v1/cars/2','/api/v1/cars/2/images','/uploads/vehicles/'+ 'a'*32+'.jpg'])
@pytest.mark.parametrize('who',[None,'outsider'])
def test_draft_privacy(client,path,who):
    assert client.get(path,headers=headers(who)).status_code==404


@pytest.mark.parametrize('who',['seller','admin'])
def test_draft_photo_owner_and_admin_allowed(client,who):
    response=client.get('/uploads/vehicles/'+ 'a'*32+'.jpg',headers=headers(who))
    assert response.status_code==200
    assert response.headers['cache-control']=='private, no-store'


@pytest.mark.parametrize('who',[None,'buyer','outsider','seller'])
def test_admin_api_denied(client,who):
    assert client.get('/api/v1/admin/cars',headers=headers(who)).status_code==(401 if who is None else 403)


@pytest.mark.parametrize('method,path,body',[
 ('GET','/api/v1/messages/conversations/1',None),
 ('POST','/api/v1/messages/conversations/1/messages',{'message':'intrusion'}),
 ('POST','/api/v1/messages/conversations/1/read',None),
 ('GET','/api/v1/deals/offers/1',None),
 ('POST','/api/v1/deals/offers/1/respond',{'action':'accept'}),
])
@pytest.mark.parametrize('who',[None,'outsider','admin'])
def test_foreign_conversation_and_offer_denied(client,db,method,path,body,who):
    assert client.request(method,path,headers=headers(who),json=body).status_code==(401 if who is None else 404)
    assert db.execute(text('SELECT COUNT(*) FROM messages')).scalar_one()==1
    assert db.execute(text('SELECT status FROM vehicle_offers WHERE id=1')).scalar_one()=='pending_seller'
    assert db.execute(text('SELECT COUNT(*) FROM messages WHERE read_at IS NOT NULL')).scalar_one()==0


@pytest.mark.parametrize('who',['seller','buyer'])
def test_participants_can_read(client,who):
    assert client.get('/api/v1/messages/conversations/1',headers=headers(who)).status_code==200
    assert client.get('/api/v1/deals/offers/1',headers=headers(who)).status_code==200


def test_watchlists_and_dashboard_are_scoped(client,db):
    assert client.get('/api/v1/deals/watchlist',headers=headers('outsider')).json()['data']==[]
    client.delete('/api/v1/deals/vehicles/1/watchlist',headers=headers('outsider'))
    assert db.execute(text('SELECT COUNT(*) FROM vehicle_watchlists WHERE user_id=2')).scalar_one()==1
    assert {r['vehicle_id'] for r in client.get('/api/v1/deals/seller/overview',headers=headers('outsider')).json()['listings']}=={3}
    assert {r['id'] for r in client.get('/api/v1/my/cars',headers=headers('outsider')).json()['data']}=={3}
    assert client.get('/api/v1/deals/offers',headers=headers('outsider')).json()['data']==[]
    assert client.get('/api/v1/messages/conversations',headers=headers('outsider')).json()['data']==[]


def test_public_fields_and_listing_filter(client):
    response=client.get('/api/v1/cars').json()['data']
    assert {r['id'] for r in response}=={1,3,4}
    assert all(not {'vin','registration_plate','owner_id','password_hash'} & r.keys() for r in response)


def test_account_response_and_mass_assignment(client,db):
    response=client.get('/api/v1/auth/me',headers=headers('buyer')).json()
    assert response['id']==2 and 'password_hash' not in response
    response=client.post('/api/v1/auth/register',headers=headers(),json={'full_name':'Fictional New','email':'new@example.com','password':'Testing-password-951','role':'admin','id':4})
    assert response.status_code==201 and response.json()['role']=='user'
    assert db.scalar(select(User).where(User.email=='new@example.com')).role=='user'


def test_negotiation_turn_and_owner_positive_controls(client,db):
    assert client.post('/api/v1/deals/offers/1/respond',headers=headers('buyer'),json={'action':'accept'}).status_code==403
    assert client.post('/api/v1/deals/offers/1/respond',headers=headers('seller'),json={'action':'counter','amount_nzd':21000}).status_code==200
    assert client.post('/api/v1/deals/offers/1/respond',headers=headers('buyer'),json={'action':'accept'}).status_code==200
    assert client.patch('/api/v1/cars/2',headers=headers('seller'),json={'price_nzd':26000}).status_code==200
    assert db.get(Vehicle,2).price_nzd==26000
