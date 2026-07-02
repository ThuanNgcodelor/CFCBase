import urllib.request
import urllib.parse
import json
import ssl
from datetime import datetime, timedelta

def request(url, method="GET", data=None, token=None):
    headers = {}
    if data:
        data = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    if token:
        headers['Authorization'] = f'Bearer {token}'
    
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        with urllib.request.urlopen(req, context=ctx) as response:
            res_body = response.read().decode('utf-8')
            return response.status, json.loads(res_body)
    except urllib.error.HTTPError as e:
        res_body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(res_body)
        except:
            return e.code, res_body
    except Exception as e:
        return 0, str(e)

base_url = "http://localhost:8080/api/v1"

print("1. Login...")
status, res = request(f"{base_url}/auth/login", method="POST", data={
    "email": "admin1@booking.base.vn",
    "password": "admin123"
})
print("Login status:", status)

if status != 200:
    print("Login failed:", res)
    exit(1)

token = res['data']['accessToken']
user_id = res['data']['user']['id']
print(f"Token obtained. User ID: {user_id}")

print("\n2. Get Rooms...")
status, res = request(f"{base_url}/resources/rooms", token=token)
print("Get rooms status:", status)
rooms = res.get('data', [])
print(f"Found {len(rooms)} rooms.")

print("\n3. Get Cars...")
status, res = request(f"{base_url}/resources/cars", token=token)
print("Get cars status:", status)
cars = res.get('data', [])
print(f"Found {len(cars)} cars.")

room_id = rooms[0]['id'] if len(rooms) > 0 else "dummy-room-id"
print(f"\n4. Booking Room with ID {room_id}...")
start_time = (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z"
end_time = (datetime.utcnow() + timedelta(days=1, hours=2)).isoformat() + "Z"
status, res = request(f"{base_url}/bookings/rooms", method="POST", token=token, data={
    "roomId": room_id,
    "requesterId": user_id,
    "title": "Họp triển khai dự án",
    "startTime": start_time,
    "endTime": end_time,
    "attendeeCount": 5,
    "note": "Test booking"
})
print("Booking room status:", status)
print("Response:", json.dumps(res, indent=2, ensure_ascii=False))

print("\n5. Get Notifications...")
status, res = request(f"{base_url}/notifications/users/{user_id}", token=token)
print("Get notifications status:", status)
print("Response:", json.dumps(res, indent=2, ensure_ascii=False))
