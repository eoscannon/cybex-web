import { ChainStore } from "cybexjs";
import React from "react";
import IntlStore from "stores/IntlStore";
import AccountStore from "stores/AccountStore";
import SettingsStore from "stores/SettingsStore";
import IntlActions from "actions/IntlActions";
import NotificationStore from "stores/NotificationStore";
import intlData from "./components/Utility/intlData";
import alt from "alt-instance";
import { connect, supplyFluxContext } from "alt-react";
import { IntlProvider } from "react-intl";
import SyncError from "./components/SyncError";
import LoadingIndicator from "./components/LoadingIndicator";
import Header from "components/Layout/Header";
import MobileMenu from "components/Layout/MobileMenu";
import ReactTooltip from "react-tooltip";
import NotificationSystem from "react-notification-system";
import TransactionConfirm from "./components/Blockchain/TransactionConfirm";
import WalletUnlockModal from "./components/Wallet/WalletUnlockModal";
import BrowserSupportModal from "./components/Modal/BrowserSupportModal";
import WalletDb from "stores/WalletDb";
import CachedPropertyStore from "stores/CachedPropertyStore";
import BackupModal from "components/Modal/BackupModal";
import { withRouter } from "react-router";
import Footer from "./components/Layout/Footer";
import Nav from "./components/Layout/Nav";
import { ModalActions } from "./actions/ModalActions";
import LogoutModal, {
  DEFAULT_LOGOUT_MODAL_ID
} from "components/Modal/LogoutModal";
import EthModal, { DEFAULT_ETH_MODAL_ID } from "components/Modal/EthModal";

class App extends React.Component {
  constructor() {
    super();

    // Check for mobile device to disable chat
    const user_agent = navigator.userAgent.toLowerCase();
    let isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    let syncFail =
      ChainStore.subError &&
      ChainStore.subError.message ===
        "ChainStore sync error, please check your system clock"
        ? true
        : false;
    this.state = {
      loading: false,
      synced: this._syncStatus(),
      syncFail,
      theme: SettingsStore.getState().settings.get("themes"),
      isMobile: !!(
        /android|ipad|ios|iphone|windows phone/i.test(user_agent) || isSafari
      ),
      incognito: false,
      incognitoWarningDismissed: false
    };

    this._rebuildTooltips = this._rebuildTooltips.bind(this);
    this._onSettingsChange = this._onSettingsChange.bind(this);
    this._chainStoreSub = this._chainStoreSub.bind(this);
    this._syncStatus = this._syncStatus.bind(this);
  }

  componentWillUnmount() {
    NotificationStore.unlisten(this._onNotificationChange);
    SettingsStore.unlisten(this._onSettingsChange);
    ChainStore.unsubscribe(this._chainStoreSub);
    clearInterval(this.syncCheckInterval);
  }

  _syncStatus(setState = false) {
    let synced = true;
    let dynGlobalObject = ChainStore.getObject("2.1.0");
    if (dynGlobalObject) {
      let block_time = dynGlobalObject.get("time");
      if (!/Z$/.test(block_time)) {
        block_time += "Z";
      }

      let bt =
        (new Date(block_time).getTime() +
          ChainStore.getEstimatedChainTimeOffset()) /
        1000;
      let now = new Date().getTime() / 1000;
      synced = Math.abs(now - bt) < 5;
    }
    if (setState && synced !== this.state.synced) {
      this.setState({ synced });
    }
    return synced;
  }

  _setListeners() {
    try {
      NotificationStore.listen(this._onNotificationChange.bind(this));
      SettingsStore.listen(this._onSettingsChange);
      ChainStore.subscribe(this._chainStoreSub);
      AccountStore.tryToSetCurrentAccount();
    } catch (e) {
      console.error("e:", e);
    }
  }

  componentDidMount() {
    this._setListeners();
    this.syncCheckInterval = setInterval(this._syncStatus, 5000);
    const user_agent = navigator.userAgent.toLowerCase();
    if (
      !(
        window.electron ||
        user_agent.indexOf("firefox") > -1 ||
        user_agent.indexOf("chrome") > -1 ||
        user_agent.indexOf("edge") > -1
      )
    ) {
      this.refs.browser_modal.show();
    }

    this.props.router.listen(this._rebuildTooltips);
    // Todo
    this.showBackupTip();
    this._rebuildTooltips();

    let loadingMask = document.getElementById("globalLoading");
    if (loadingMask) {
      loadingMask.classList.add("fade-out");
      setTimeout(() => loadingMask.remove(), 500);
    }
    ModalActions.showModal("gameModal", true);
    ModalActions.showModal(DEFAULT_ETH_MODAL_ID, true);
  }

  _onIgnoreIncognitoWarning() {
    this.setState({ incognitoWarningDismissed: true });
  }

  showBackupTip() {
    var wallet = WalletDb.getWallet();
    let backup_recommended =
      wallet &&
      (!wallet.backup_date || CachedPropertyStore.get("backup_recommended"));
    if (
      this.props.router.location.pathname.search("wallet/backup/create") ===
        -1 &&
      backup_recommended
    )
      this.backupModal.show();
  }

  _rebuildTooltips() {
    ReactTooltip.hide();

    setTimeout(() => {
      if (this.refs.tooltip) {
        this.refs.tooltip.globalRebuild();
      }
    }, 1500);
  }

  _onLocaleChange(state) {
    // console.debug("[APP]locale change: ", state);
    this.forceUpdate();
  }

  _chainStoreSub() {
    let synced = this._syncStatus();
    if (synced !== this.state.synced) {
      this.setState({ synced });
    }
    if (ChainStore.subscribed !== this.state.synced || ChainStore.subError) {
      let syncFail =
        ChainStore.subError &&
        ChainStore.subError.message ===
          "ChainStore sync error, please check your system clock"
          ? true
          : false;
      this.setState({
        syncFail
      });
    }
  }

  /** Usage: NotificationActions.[success,error,warning,info] */
  _onNotificationChange() {
    let notification = NotificationStore.getState().notification;
    if (notification.autoDismiss === void 0) {
      notification.autoDismiss = 10;
    }
    if (this.refs.notificationSystem)
      this.refs.notificationSystem.addNotification(notification);
  }

  _onSettingsChange() {
    let { settings, viewSettings } = SettingsStore.getState();
    if (settings.get("themes") !== this.state.theme) {
      this.setState({
        theme: settings.get("themes")
      });
    }
  }

  // /** Non-static, used by passing notificationSystem via react Component refs */
  // _addNotification(params) {
  //     console.log("add notification:", this.refs, params);
  //     this.refs.notificationSystem.addNotification(params);
  // }

  render() {
    let { isMobile, theme } = this.state;
    let content = null;

    let showFooter = 1;
    // if(incognito && !incognitoWarningDismissed){
    //     content = (
    //         <Incognito onClickIgnore={this._onIgnoreIncognitoWarning.bind(this)}/>
    //     );
    // } else
    if (this.state.syncFail) {
      content = <SyncError />;
    } else if (this.state.loading) {
      content = (
        <div className="grid-frame vertical">
          <LoadingIndicator
            loadingText={"Connecting to APIs and starting app"}
          />
        </div>
      );
    } else if (this.props.location.pathname === "/init-error") {
      content = (
        <div className="grid-frame vertical">{this.props.children}</div>
      );
    } else {
      content = (
        <div className="grid-frame vertical">
          <Header />
          <MobileMenu isUnlocked={this.state.isUnlocked} id="mobile-menu" />
          <div className="main-body">
            <Nav />
            <div className="grid-block">
              <div className="grid-block vertical">{this.props.children}</div>
            </div>
          </div>
          {showFooter ? <Footer synced={this.state.synced} /> : null}
          <ReactTooltip
            ref="tooltip"
            place="top"
            type={theme === "lightTheme" ? "dark" : "light"}
            effect="solid"
          />
        </div>
      );
    }

    return (
      <div
        style={{ backgroundColor: !this.state.theme ? "#2a2a2a" : null }}
        className={this.state.theme}
      >
        <div id="content-wrapper">
          {content}
          <NotificationSystem
            ref="notificationSystem"
            allowHTML={true}
            style={{
              Containers: {
                DefaultStyle: {
                  width: "425px"
                }
              }
            }}
          />
          <TransactionConfirm />
          <BackupModal
            ref={backup => {
              this.backupModal = backup;
            }}
          />
          <WalletUnlockModal />
          {/* Logout Modal*/}
          <LogoutModal modalId={DEFAULT_LOGOUT_MODAL_ID} />
          <EthModal modalId={DEFAULT_ETH_MODAL_ID} />
          <BrowserSupportModal ref="browser_modal" />
        </div>
      </div>
    );
  }
}

App = withRouter(App);

class RootIntl extends React.Component {
  componentWillMount() {
    IntlActions.switchLocale(this.props.locale);
  }

  render() {
    return (
      <IntlProvider
        locale={this.props.locale}
        formats={intlData.formats}
        initialNow={Date.now()}
      >
        <App {...this.props} />
      </IntlProvider>
    );
  }
}

RootIntl = connect(RootIntl, {
  listenTo() {
    return [IntlStore];
  },
  getProps() {
    return {
      locale: IntlStore.getState().currentLocale
    };
  }
});

class Root extends React.Component {
  static childContextTypes = {
    router: React.PropTypes.object,
    location: React.PropTypes.object
  };

  componentDidMount() {
    //Detect OS for platform specific fixes
    if (navigator.platform.indexOf("Win") > -1) {
      var main = document.getElementById("content");
      var windowsClass = "windows";
      if (main.className.indexOf("windows") === -1) {
        main.className =
          main.className + (main.className.length ? " " : "") + windowsClass;
      }
    }

    const user_agent = navigator.userAgent.toLowerCase();
    if (
      !(
        window.electron ||
        user_agent.indexOf("firefox") > -1 ||
        user_agent.indexOf("chrome") > -1 ||
        user_agent.indexOf("edge") > -1
      )
    ) {
      this.refs.browser_modal.show();
    }
  }

  getChildContext() {
    return {
      router: this.props.router,
      location: this.props.location
    };
  }

  render() {
    return <RootIntl {...this.props} />;
  }
}

export default supplyFluxContext(alt)(Root);
