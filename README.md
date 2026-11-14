# Tap Rush (mobile-game)

Expo (SDK 57) + [`@shopify/react-native-skia`](https://shopify.github.io/react-native-skia/) ile yazılmış yer tutucu bir mobil oyun.
Ekranda beliren daireler küçülerek kaybolur; kaybolmadan dokun. 3 can, seviye arttıkça hızlanır.

`main` dalına yapılan her push GitHub Actions'ta iOS derlemesi yapar, build numarasını otomatik artırır ve
TestFlight'a yükler (`.github/workflows/ios-testflight.yml`). Hat, `heyobi/draftrewind` ile aynı yaklaşımı ve aynı
secret adlarını kullanır: `expo prebuild` → manuel imzalama (Apple Distribution) → `xcodebuild archive/export` →
`xcrun altool` ile App Store Connect API anahtarıyla yükleme. EAS kullanılmaz (ücretsiz).

Fark: provisioning profili repoya konmaz; iş akışı App Store Connect API ile profili kendisi oluşturur/indirir
(`scripts/asc.js`), build numarasını da App Store Connect'teki en yüksek build + 1 olarak seçer.

## Yerelde çalıştırma

```bash
npm install
npx expo start
```

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

## Apple tarafında bir kerelik adımlar

1. **Bundle ID:** [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list) → `+` →
   App IDs → App → Explicit Bundle ID `com.heyobi.mobilegame` (ek yetenek gerekmez).
   (Atlanırsa iş akışı API ile kendisi kaydetmeyi dener.)
2. **Uygulama kaydı:** [App Store Connect → Uygulamalar](https://appstoreconnect.apple.com/apps) → `+` → Yeni Uygulama →
   iOS, istediğiniz ad, birincil dil, Bundle ID `com.heyobi.mobilegame`, SKU ör. `mobilegame`.
3. **Dahili test grubu:** Uygulamanın **TestFlight** sekmesi → Dahili Test (Internal Testing) yanında `+` →
   grup adı ör. `Developers`, **Otomatik dağıtımı etkinleştir** (Enable automatic distribution) işaretli →
   kendinizi test kullanıcısı olarak ekleyin. (Test grupları uygulama başınadır; draftrewind'deki grup buraya taşınmaz.)
   Otomatik dağıtım açıkken her yeni build işlenince gruptaki herkese kendiliğinden gelir.
4. iPhone'da **TestFlight** uygulamasını açın; build birkaç dakikalık işlemden sonra görünür.

"Submit for Review" gerekmez; dahili TestFlight testleri için inceleme yoktur.

## GitHub Actions dakikaları

Repo özel (private) olduğu için macOS dakikaları ücretsiz kotadan **10 kat** sayılır (GitHub Free: ayda 2000 dk →
yaklaşık 200 macOS dakikası, bir derleme ~8–12 dk). Ödeme yöntemi/harcama limiti tanımlı değilse kota bitince
iş akışları durur, ücret çıkmaz. Kotayı korumak için: yalnızca `.md` değişen push'lar derlenmez; aynı anda tek
derleme çalışır ve arada biriken push'lardan yalnızca sonuncusu derlenir. Repo herkese açık (public) yapılırsa
dakikalar sınırsız ve ücretsizdir.
