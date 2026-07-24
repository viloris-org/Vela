import AppKit
import Foundation

let version = ShellController.version

func printUsage() {
  let text = """
  vela-desktop-shell \(version)

  Usage:
    vela-desktop-shell [--url URL] [--version] [--help]

  Options:
    --url URL     Navigate main WebView (default: http://127.0.0.1:5174)
    --version     Print version and exit
    --help        Show this help

  Host dogfood (clock — preferred minimal app):
    bun run example:clock                    # other terminal → :5174
    .build/release/vela-desktop-shell --url http://127.0.0.1:5174

  Playground:
    bun run playground:serve                 # → :5173
    .build/release/vela-desktop-shell --url http://127.0.0.1:5173

  Requires: macOS 14+, Xcode / Swift 5.9+. See README.md.
  """
  print(text)
}

var urlString = "http://127.0.0.1:5174"
var i = 1
let args = CommandLine.arguments
while i < args.count {
  let a = args[i]
  switch a {
  case "--help", "-h":
    printUsage()
    exit(0)
  case "--version", "-V":
    print(version)
    exit(0)
  case "--url":
    i += 1
    guard i < args.count else {
      fputs("--url expects a URL\n", stderr)
      exit(2)
    }
    urlString = args[i]
  case let s where s.hasPrefix("--url="):
    urlString = String(s.dropFirst("--url=".count))
  default:
    fputs("Unknown argument: \(a)\n", stderr)
    printUsage()
    exit(2)
  }
  i += 1
}

guard let url = URL(string: urlString) else {
  fputs("Invalid URL: \(urlString)\n", stderr)
  exit(2)
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)

let shell = ShellController(url: url)
shell.show()
app.activate(ignoringOtherApps: true)
app.run()
