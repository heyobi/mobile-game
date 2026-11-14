# Neon Swarm (mobile-game)

Neon horde-survival roguelite (5 dakikalık run, tek parmak, otomatik ateş, seviye başına 3 güçten biri). Expo (SDK 57) + TypeScript +
[`@shopify/react-native-skia`](https://shopify.github.io/react-native-skia/). Tasarım: [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md).

## Geliştirme

```bash
npm install
npm run check      # lint + typecheck + testler (CI'daki kalite kapısı)
npx expo start     # cihazda geliştirme için
```

Oyun mantığı `src/game/` altında saf TypeScript'tir ve `npm test` ile test edilir; arayüz `src/ui/` altındadır.

## Sürüm hattı

`main` dalına yapılan her push GitHub Actions'ta iOS derlemesi yapar, build numarasını otomatik artırır ve
TestFlight'a yükler (`.github/workflows/ios-testflight.yml`). Hat, `heyobi/draftrewind` ile aynı yaklaşımı ve aynı
secret adlarını kullanır: `expo prebuild` → manuel imzalama (Apple Distribution) → `xcodebuild archive/export` →
`xcrun altool` ile App Store Connect API anahtarıyla yükleme. EAS kullanılmaz (ücretsiz).

Fark: provisioning profili repoya konmaz; iş akışı App Store Connect API ile profili kendisi oluşturur/indirir
(`scripts/asc.js`), build numarasını da App Store Connect'teki en yüksek build + 1 olarak seçer.

## Gerekli repository secret'ları

| Secret | İçerik |
| --- | --- |
| `APP_STORE_CONNECT_KEY_ID` | App Store Connect API anahtarının Key ID'si |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID |
| `APP_STORE_CONNECT_PRIVATE_KEY` | `AuthKey_XXXX.p8` dosyasının içeriği |
| `BUILD_CERTIFICATE_BASE64` | Apple Distribution sertifikası (`.p12`), base64 |
| `P12_PASSWORD` | `.p12` parolası |
| `KEYCHAIN_PASSWORD` | CI'daki geçici keychain için rastgele parola (zaten ayarlandı) |

draftrewind'de kullanılan anahtar ve sertifikanın aynısı kullanılabilir. API anahtarının rolü **Admin** (ya da
sertifika/profil erişimli App Manager) olmalı; iş akışı profil ve gerekirse bundle ID oluşturur.

Secret'ları kendi bilgisayarınızda, dosyadan okuyarak ekleyin (değerleri hiçbir yere yapıştırmanıza gerek yok):

```bash
gh secret set APP_STORE_CONNECT_KEY_ID -R heyobi/mobile-game        # değeri terminal sorar
gh secret set APP_STORE_CONNECT_ISSUER_ID -R heyobi/mobile-game     # değeri terminal sorar
gh secret set APP_STORE_CONNECT_PRIVATE_KEY -R heyobi/mobile-game < AuthKey_XXXX.p8
gh secret set P12_PASSWORD -R heyobi/mobile-game                    # değeri terminal sorar
```

`.p12` için (PowerShell):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\yol\dagitim.p12")) | gh secret set BUILD_CERTIFICATE_BASE64 -R heyobi/mobile-game
```

(macOS/Linux: `base64 < dagitim.p12 | tr -d '\n' | gh secret set BUILD_CERTIFICATE_BASE64 -R heyobi/mobile-game`)

## Apple tarafı (kurulu)

- Bundle ID `com.heyobi.mobilegame` kayıtlı (iş akışı yoksa API ile kendisi kaydeder).
- App Store Connect uygulama kaydı: **Heyobi Game** (geçici ad, yayından önce değiştirilebilir), app id `6834633630`.
- TestFlight dahili grubu **Developers**: otomatik dağıtım açık, hesap sahibi test kullanıcısı. Her yeni build
  işlendiğinde iPhone'daki TestFlight uygulamasına kendiliğinden gelir.
- Yeni bir dahili test kullanıcısı eklemek için: App Store Connect → Heyobi Game → TestFlight → Developers →
  Testers `+` (kullanıcının önce Kullanıcılar ve Erişim'de olması gerekir).

"Submit for Review" gerekmez; dahili TestFlight testleri için inceleme yoktur.

## GitHub Actions dakikaları

Repo herkese açık (public) olduğu için standart GitHub koşucuları (macOS dahil) ücretsiz ve dakika sınırı yoktur.
Secret'lar herkese açık repoda da gizli kalır; fork'lardan açılan PR'lar secret'lara erişemez ve bu iş akışı yalnızca
`main`'e push ve elle tetiklemede çalışır. Yalnızca `.md` değişen push'lar derlenmez; aynı anda tek derleme çalışır.
