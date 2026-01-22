import UIKit
import WebKit

/**
 * Applyn Smart Hybrid App - ViewController
 *
 * Features:
 * - WKWebView with JavaScript support
 * - JS Bridge Communication (window.webkit.messageHandlers.applyn)
 * - Pull-to-Refresh
 * - Offline Screen
 * - Native Alerts/Dialogs
 * - External Link Handling
 * - Loading Progress Bar
 */
class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    
    // MARK: - Properties
    private var webView: WKWebView!
    private var progressView: UIProgressView!
    private var activityIndicator: UIActivityIndicatorView!
    private var offlineView: UIView!
    private var refreshControl: UIRefreshControl!
    
    // Configuration (injected during build)
    private let websiteURL = "__WEBSITE_URL__"
    private let primaryColor = "__PRIMARY_COLOR__"
    private let pullToRefreshEnabled = __PULL_TO_REFRESH_ENABLED__
    private let offlineScreenEnabled = __OFFLINE_SCREEN_ENABLED__
    
    // MARK: - Lifecycle
    
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(hex: primaryColor) ?? .systemBlue
        
        setupWebView()
        setupProgressView()
        setupActivityIndicator()
        setupOfflineView()
        setupPullToRefresh()
        loadWebsite()
    }
    
    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .lightContent
    }
    
    // MARK: - Setup WebView
    
    private func setupWebView() {
        let config = WKWebViewConfiguration()
        
        // Enable JavaScript
        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = prefs
        
        // Setup data store for offline caching
        config.websiteDataStore = WKWebsiteDataStore.default()
        
        // Setup JS Bridge message handler
        let contentController = WKUserContentController()
        contentController.add(self, name: "applyn")
        
        // Inject JS Bridge helper script
        let bridgeScript = WKUserScript(
            source: jsBridgeHelperScript(),
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: false
        )
        contentController.addUserScript(bridgeScript)
        config.userContentController = contentController
        
        // Media playback configuration
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        
        // Create WebView
        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.bounces = true
        
        // Add progress observer
        webView.addObserver(self, forKeyPath: "estimatedProgress", options: .new, context: nil)
        
        // Safe area handling
        if #available(iOS 11.0, *) {
            webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        }
        
        view.addSubview(webView)
    }
    
    // MARK: - Setup Progress View
    
    private func setupProgressView() {
        progressView = UIProgressView(progressViewStyle: .default)
        progressView.frame = CGRect(x: 0, y: view.safeAreaInsets.top, width: view.frame.width, height: 4)
        progressView.autoresizingMask = [.flexibleWidth]
        progressView.progressTintColor = UIColor(hex: primaryColor) ?? .systemBlue
        progressView.trackTintColor = UIColor(hex: primaryColor)?.withAlphaComponent(0.2)
        progressView.isHidden = true
        view.addSubview(progressView)
    }
    
    private func setupActivityIndicator() {
        activityIndicator = UIActivityIndicatorView(style: .large)
        activityIndicator.center = view.center
        activityIndicator.hidesWhenStopped = true
        view.addSubview(activityIndicator)
    }
    
    // MARK: - Setup Offline View
    
    private func setupOfflineView() {
        offlineView = UIView(frame: view.bounds)
        offlineView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        offlineView.backgroundColor = UIColor(hex: primaryColor) ?? .systemBlue
        offlineView.isHidden = true
        
        let stackView = UIStackView()
        stackView.axis = .vertical
        stackView.alignment = .center
        stackView.spacing = 16
        stackView.translatesAutoresizingMaskIntoConstraints = false
        
        let iconLabel = UILabel()
        iconLabel.text = "📡"
        iconLabel.font = .systemFont(ofSize: 64)
        
        let titleLabel = UILabel()
        titleLabel.text = "You're Offline"
        titleLabel.font = .boldSystemFont(ofSize: 24)
        titleLabel.textColor = .white
        
        let messageLabel = UILabel()
        messageLabel.text = "Please check your internet connection and try again."
        messageLabel.font = .systemFont(ofSize: 16)
        messageLabel.textColor = .white.withAlphaComponent(0.8)
        messageLabel.textAlignment = .center
        messageLabel.numberOfLines = 0
        
        let retryButton = UIButton(type: .system)
        retryButton.setTitle("Retry", for: .normal)
        retryButton.setTitleColor(UIColor(hex: primaryColor) ?? .systemBlue, for: .normal)
        retryButton.backgroundColor = .white
        retryButton.titleLabel?.font = .boldSystemFont(ofSize: 16)
        retryButton.layer.cornerRadius = 8
        retryButton.contentEdgeInsets = UIEdgeInsets(top: 12, left: 32, bottom: 12, right: 32)
        retryButton.addTarget(self, action: #selector(retryTapped), for: .touchUpInside)
        
        stackView.addArrangedSubview(iconLabel)
        stackView.addArrangedSubview(titleLabel)
        stackView.addArrangedSubview(messageLabel)
        stackView.addArrangedSubview(retryButton)
        
        offlineView.addSubview(stackView)
        
        NSLayoutConstraint.activate([
            stackView.centerXAnchor.constraint(equalTo: offlineView.centerXAnchor),
            stackView.centerYAnchor.constraint(equalTo: offlineView.centerYAnchor),
            stackView.leadingAnchor.constraint(greaterThanOrEqualTo: offlineView.leadingAnchor, constant: 32),
            stackView.trailingAnchor.constraint(lessThanOrEqualTo: offlineView.trailingAnchor, constant: -32)
        ])
        
        view.addSubview(offlineView)
    }
    
    // MARK: - Setup Pull to Refresh
    
    private func setupPullToRefresh() {
        guard pullToRefreshEnabled else { return }
        
        refreshControl = UIRefreshControl()
        refreshControl.tintColor = .white
        refreshControl.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
        webView.scrollView.refreshControl = refreshControl
    }
    
    @objc private func handleRefresh() {
        webView.reload()
    }
    
    @objc private func retryTapped() {
        if isNetworkAvailable() {
            offlineView.isHidden = true
            loadWebsite()
        } else {
            showAlert(title: "Still Offline", message: "Please check your connection and try again.")
        }
    }
    
    // MARK: - Load Website
    
    private func loadWebsite() {
        guard let url = URL(string: websiteURL) else {
            showError(message: "Invalid URL: \(websiteURL)")
            return
        }
        
        var request = URLRequest(url: url)
        request.cachePolicy = .returnCacheDataElseLoad
        
        activityIndicator.startAnimating()
        webView.load(request)
    }
    
    // MARK: - Progress Observer
    
    override func observeValue(forKeyPath keyPath: String?, of object: Any?, change: [NSKeyValueChangeKey : Any]?, context: UnsafeMutableRawPointer?) {
        if keyPath == "estimatedProgress" {
            let progress = Float(webView.estimatedProgress)
            progressView.isHidden = progress >= 1.0
            progressView.setProgress(progress, animated: true)
        }
    }
    
    // MARK: - WKNavigationDelegate
    
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        activityIndicator.startAnimating()
        progressView.isHidden = false
        progressView.setProgress(0, animated: false)
    }
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        activityIndicator.stopAnimating()
        refreshControl?.endRefreshing()
        progressView.isHidden = true
        offlineView.isHidden = true
    }
    
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        activityIndicator.stopAnimating()
        refreshControl?.endRefreshing()
        progressView.isHidden = true
        
        let nsError = error as NSError
        if nsError.code == NSURLErrorNotConnectedToInternet ||
           nsError.code == NSURLErrorNetworkConnectionLost {
            if offlineScreenEnabled {
                offlineView.isHidden = false
            } else {
                loadFromCache()
            }
        } else if nsError.code != NSURLErrorCancelled {
            showError(message: error.localizedDescription)
        }
    }
    
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        activityIndicator.stopAnimating()
        refreshControl?.endRefreshing()
        let nsError = error as NSError
        if nsError.code != NSURLErrorCancelled {
            showError(message: error.localizedDescription)
        }
    }
    
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        
        // Handle external URL schemes
        let externalSchemes = ["tel", "mailto", "sms", "facetime", "whatsapp", "tg", "fb", "twitter", "instagram"]
        if let scheme = url.scheme?.lowercased(), externalSchemes.contains(scheme) {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
            decisionHandler(.cancel)
            return
        }
        
        // Handle App Store / iTunes links
        if url.host?.contains("itunes.apple.com") == true || url.host?.contains("apps.apple.com") == true {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
            decisionHandler(.cancel)
            return
        }
        
        // Handle external domains
        let externalDomains = ["wa.me", "t.me", "youtube.com", "youtu.be", "facebook.com", "instagram.com", "twitter.com", "x.com"]
        if let host = url.host, externalDomains.contains(where: { host.contains($0) }) {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
            decisionHandler(.cancel)
            return
        }
        
        decisionHandler(.allow)
    }
    
    // MARK: - WKUIDelegate
    
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
        }
        return nil
    }
    
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            completionHandler()
        })
        present(alert, animated: true, completion: nil)
    }
    
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in
            completionHandler(false)
        })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            completionHandler(true)
        })
        present(alert, animated: true, completion: nil)
    }
    
    // MARK: - WKScriptMessageHandler (JS Bridge)
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "applyn" else { return }
        
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else {
            return
        }
        
        switch action {
        case "showToast":
            if let msg = body["message"] as? String {
                showToast(message: msg)
            }
            
        case "share":
            let title = body["title"] as? String ?? ""
            let text = body["text"] as? String ?? ""
            let url = body["url"] as? String ?? ""
            shareContent(title: title, text: text, url: url)
            
        case "navigateTo":
            if let urlString = body["url"] as? String, let url = URL(string: urlString) {
                webView.load(URLRequest(url: url))
            }
            
        case "goBack":
            if webView.canGoBack { webView.goBack() }
            
        case "reload":
            webView.reload()
            
        case "getDeviceInfo":
            sendDeviceInfoToJS()
            
        case "openExternal":
            if let urlString = body["url"] as? String, let url = URL(string: urlString) {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
            
        default:
            print("Applyn: Unknown action - \(action)")
        }
    }
    
    // MARK: - JS Bridge Helper Script
    
    private func jsBridgeHelperScript() -> String {
        return """
        (function() {
            if (window.ApplynBridge) return;
            
            window.ApplynBridge = {
                showToast: function(message) {
                    window.webkit.messageHandlers.applyn.postMessage({
                        action: 'showToast',
                        message: message
                    });
                },
                
                share: function(title, text, url) {
                    window.webkit.messageHandlers.applyn.postMessage({
                        action: 'share',
                        title: title || '',
                        text: text || '',
                        url: url || ''
                    });
                },
                
                navigateTo: function(url) {
                    window.webkit.messageHandlers.applyn.postMessage({
                        action: 'navigateTo',
                        url: url
                    });
                },
                
                goBack: function() {
                    window.webkit.messageHandlers.applyn.postMessage({ action: 'goBack' });
                },
                
                reload: function() {
                    window.webkit.messageHandlers.applyn.postMessage({ action: 'reload' });
                },
                
                getDeviceInfo: function(callback) {
                    window.ApplynBridge._deviceInfoCallback = callback;
                    window.webkit.messageHandlers.applyn.postMessage({ action: 'getDeviceInfo' });
                },
                
                openExternalUrl: function(url) {
                    window.webkit.messageHandlers.applyn.postMessage({
                        action: 'openExternal',
                        url: url
                    });
                },
                
                postMessage: function(data) {
                    window.webkit.messageHandlers.applyn.postMessage(data);
                }
            };
            
            // Dispatch ready event
            window.dispatchEvent(new CustomEvent('applynReady', {
                detail: { platform: 'ios', version: '__APP_VERSION__' }
            }));
        })();
        """
    }
    
    private func sendDeviceInfoToJS() {
        let deviceInfo: [String: Any] = [
            "platform": "ios",
            "version": UIDevice.current.systemVersion,
            "model": UIDevice.current.model,
            "appVersion": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
        ]
        
        if let jsonData = try? JSONSerialization.data(withJSONObject: deviceInfo),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            let js = "if (window.ApplynBridge._deviceInfoCallback) { window.ApplynBridge._deviceInfoCallback(\(jsonString)); }"
            webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }
    
    // MARK: - Native Features
    
    private func showToast(message: String) {
        let toast = UILabel()
        toast.text = message
        toast.textColor = .white
        toast.backgroundColor = UIColor.black.withAlphaComponent(0.7)
        toast.textAlignment = .center
        toast.font = .systemFont(ofSize: 14)
        toast.layer.cornerRadius = 8
        toast.clipsToBounds = true
        toast.numberOfLines = 0
        
        let padding: CGFloat = 16
        let maxWidth = view.frame.width - 64
        let size = toast.sizeThatFits(CGSize(width: maxWidth, height: .greatestFiniteMagnitude))
        toast.frame = CGRect(
            x: (view.frame.width - size.width - padding * 2) / 2,
            y: view.frame.height - 120,
            width: size.width + padding * 2,
            height: size.height + padding
        )
        
        view.addSubview(toast)
        
        UIView.animate(withDuration: 0.3, delay: 2.0, options: .curveEaseOut) {
            toast.alpha = 0
        } completion: { _ in
            toast.removeFromSuperview()
        }
    }
    
    private func shareContent(title: String, text: String, url: String) {
        var items: [Any] = []
        if !text.isEmpty { items.append(text) }
        if !url.isEmpty, let shareUrl = URL(string: url) { items.append(shareUrl) }
        
        guard !items.isEmpty else { return }
        
        let activityVC = UIActivityViewController(activityItems: items, applicationActivities: nil)
        activityVC.popoverPresentationController?.sourceView = view
        present(activityVC, animated: true, completion: nil)
    }
    
    // MARK: - Helpers
    
    private func isNetworkAvailable() -> Bool {
        // Simple reachability check
        guard let url = URL(string: "https://www.apple.com") else { return false }
        var request = URLRequest(url: url)
        request.timeoutInterval = 5
        request.httpMethod = "HEAD"
        
        let semaphore = DispatchSemaphore(value: 0)
        var isAvailable = false
        
        URLSession.shared.dataTask(with: request) { _, response, _ in
            isAvailable = (response as? HTTPURLResponse)?.statusCode == 200
            semaphore.signal()
        }.resume()
        
        semaphore.wait()
        return isAvailable
    }
    
    private func loadFromCache() {
        guard let url = URL(string: websiteURL) else { return }
        var request = URLRequest(url: url)
        request.cachePolicy = .returnCacheDataDontLoad
        webView.load(request)
    }
    
    private func showError(message: String) {
        showAlert(title: "Error", message: message)
    }
    
    private func showAlert(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default, handler: nil))
        present(alert, animated: true, completion: nil)
    }
    
    deinit {
        webView.removeObserver(self, forKeyPath: "estimatedProgress")
    }
}

// MARK: - UIColor Extension

extension UIColor {
    convenience init?(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")
        
        var rgb: UInt64 = 0
        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else { return nil }
        
        let length = hexSanitized.count
        let r, g, b, a: CGFloat
        
        if length == 6 {
            r = CGFloat((rgb & 0xFF0000) >> 16) / 255.0
            g = CGFloat((rgb & 0x00FF00) >> 8) / 255.0
            b = CGFloat(rgb & 0x0000FF) / 255.0
            a = 1.0
        } else if length == 8 {
            r = CGFloat((rgb & 0xFF000000) >> 24) / 255.0
            g = CGFloat((rgb & 0x00FF0000) >> 16) / 255.0
            b = CGFloat((rgb & 0x0000FF00) >> 8) / 255.0
            a = CGFloat(rgb & 0x000000FF) / 255.0
        } else {
            return nil
        }
        
        self.init(red: r, green: g, blue: b, alpha: a)
    }
}
