SELECT 
    u.id,
    u.email,
    u.full_name,
    ss.two_factor_enabled,
    ss.two_factor_method,
    ss.last_two_factor_setup
FROM users u
LEFT JOIN security_settings ss ON u.id = ss.user_id
WHERE u.email = 'mettumanith0@gmail.com';
