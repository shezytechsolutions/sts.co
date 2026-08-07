from werkzeug.security import generate_password_hash, check_password_hash

# Test password hashing
password = 'Admin123!'
hashed = generate_password_hash(password)
print(f"Password: {password}")
print(f"Hashed: {hashed}")

# Test if it verifies
test_check = check_password_hash(hashed, password)
print(f"Verification: {test_check}")

# Also test with a known hash
known_hash = '$2b$12$qB9v2t6n9U6LQ2q8W1b3ZOI8X9vY6Z2A3B4C5D6E7F8G9H0I1J2K3L4'
test_check2 = check_password_hash(known_hash, 'Admin123!')
print(f"Known hash verification: {test_check2}")