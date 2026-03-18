export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

const MIN_LENGTH = 12;

const CHAR_CHECKS: Array<{ regex: RegExp; label: string }> = [
  { regex: /[A-Z]/, label: "uppercase letter" },
  { regex: /[a-z]/, label: "lowercase letter" },
  { regex: /[0-9]/, label: "digit" },
  { regex: /[^A-Za-z0-9]/, label: "special character" },
];

const COMMON_PASSWORDS: ReadonlySet<string> = buildWeakPasswordSet();

function buildWeakPasswordSet(): Set<string> {
  const passwords = [
    "password", "123456", "12345678", "qwerty", "abc123", "monkey", "1234567",
    "letmein", "trustno1", "dragon", "baseball", "iloveyou", "master", "sunshine",
    "ashley", "bailey", "shadow", "123123", "654321", "superman", "qazwsx",
    "michael", "football", "password1", "password123", "batman", "access",
    "hello", "charlie", "donald", "666666", "jordan", "thomas", "andrew",
    "hunter", "hockey", "ranger", "buster", "george", "soccer", "jennifer",
    "ginger", "joshua", "starwars", "robert", "matthew", "harley", "daniel",
    "welcome", "welcome1", "1234567890", "123456789", "000000", "111111",
    "121212", "131313", "passw0rd", "p@ssw0rd", "p@ssword", "pass1234",
    "admin", "admin123", "root", "toor", "changeme", "default", "guest",
    "login", "test", "test123", "temp", "temp123", "user", "user123",
    "qwerty123", "qwerty1", "asdfgh", "zxcvbn", "1q2w3e4r", "1q2w3e",
    "q1w2e3r4", "1qaz2wsx", "zaq1xsw2", "qweasdzxc", "computer",
    "internet", "server", "samantha", "whatever", "pepper", "tigger",
    "trustno1", "samsung", "fuckyou", "fuckme", "asshole", "biteme",
    "secret", "summer", "winter", "spring", "autumn", "midnight", "princess",
    "diamond", "crystal", "angel", "angels", "anthony", "friends",
    "butterfly", "purple", "chicken", "killer", "corvette", "mustang",
    "ferrari", "mercedes", "porsche", "cheese", "cookie", "coffee",
    "chocolate", "banana", "orange", "lemon", "mango", "raspberry",
    "blueberry", "strawberry", "pineapple", "watermelon", "january",
    "february", "march", "april", "june", "july", "august",
    "september", "october", "november", "december", "monday",
    "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "bitcoin", "ethereum", "crypto", "blockchain", "wallet", "defi",
    "opensea", "metamask", "phantom", "solana", "cardano", "polkadot",
    "password12", "password1234", "p@ssword123", "letmein123",
    "welcome123", "iloveyou1", "iloveyou123", "sunshine1",
    "qwerty12345", "abcdef", "abcdefg", "abcdefgh",
    "abcdef123", "123abc", "abc12345", "aaaaaa", "aaaaaaaaa",
    "aaaaaaaaaa", "qqqqqq", "zzzzzz", "asdasd", "qweqwe",
    "102030", "112233", "123321", "159753", "222222", "333333",
    "444444", "555555", "777777", "888888", "999999",
  ];
  return new Set(passwords.map((p) => p.toLowerCase()));
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < MIN_LENGTH) {
    errors.push(`Password must be at least ${MIN_LENGTH} characters (got ${password.length})`);
  }

  for (const check of CHAR_CHECKS) {
    if (!check.regex.test(password)) {
      errors.push(`Password must contain at least one ${check.label}`);
    }
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push("Password is too common");
  } else {
    const lower = password.toLowerCase();
    for (const weak of COMMON_PASSWORDS) {
      if (weak.length >= 6 && lower.startsWith(weak)) {
        errors.push("Password is too common");
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
