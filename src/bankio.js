(function () {
  "use strict";

  // This config stores the important strings needed to
  // connect to the bankio API and OAuth service
  //
  // Storing these here is insecure for a public app
  // See part II. of this tutorial for an example of how
  // to do a server-side OAuth flow and avoid this problem
  var config = {
    clientId: "WKETJ4mufKKaV58dkDjaM",
    redirectUri: document.location.origin + document.location.pathname,
    authUrl: 'https://bankio.ro/create-power-bi-account-consent',
    tokenUrl: "https://ob.bankio.ro/api/auth/token",
    baseUrl: `https://ob.bankio.ro/api/org/bankio`

    // authUrl: "https://dev.bankio.ro:8000/create-power-bi-account-consent",
    // tokenUrl: "https://dev.bankio.ro:8443/api/auth/token",
    // baseUrl: `https://dev.bankio.ro:8443/api/org/bankio`
  };

  // Called when web page first loads and when
  // the OAuth flow returns to the page
  //
  // This function parses the access token in the URI if available
  // It also adds a link to the bankio connect button
  $(document).ready(function () {
    const prefixed = Qs.parse(document.location.search, { ignoreQueryPrefix: true });

    // var accessToken = Cookies.get("accessToken");
    // var hasAuth = accessToken && accessToken.length > 0;
    // const hasAuth = tableau.password.length > 0;
    const hasAuth = false;

    updateUIWithAuthState(hasAuth);

    $("#connectbutton").click(function () {
      doAuthRedirect();
    });

    $("#getvenuesbutton").click(function () {
      tableau.connectionName = "bankIO Venues Data";
      tableau.submit();
    });
  });

  // An on-click function for the connect to bankio button,
  // This will redirect the user to a bankIO login
  function doAuthRedirect() {
    var appId = config.clientId;
    if (tableau.authPurpose === tableau.authPurposeEnum.ephemerel) {
      appId = config.clientId; // This should be Desktop
    } else if (tableau.authPurpose === tableau.authPurposeEnum.enduring) {
      appId = config.clientId; // This should be the Tableau Server appID
    }

    var url = config.authUrl + "?response_type=code&client_id=" + appId + "&redirect_uri=" + config.redirectUri;
    window.location.href = url;
  }

  function ajaxPromise(options) {
    return new Promise(function (fulfill, reject) {
      $.ajax({
        ...options,
        success: function (data) {
          fulfill(data);
        },
        error: function (xhr, ajaxOptions, thrownError) {
          // WDC should do more granular error checking here
          // or on the server side.  This is just a sample of new API.
          reject(thrownError);
        },
      });
    });
  }

  //------------- OAuth Helpers -------------//
  // This helper function returns the URI for the venueLikes endpoint
  // It appends the passed in accessToken to the call to personalize the call for the user
  function getAccounts(accessToken) {
    //   return "https://ob.bankio.ro/api/org/bankio/v1/accounts";
    const connectionUri = `${config.baseUrl}/v1/accounts`;

    var xhr = ajaxPromise({
      url: connectionUri,
      dataType: "json",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }).then((data) => data.accounts);

    return xhr;
  }

  function getBalances(accessToken) {
    const accountsPromise = getAccounts(accessToken);

    return accountsPromise.then((accounts) => {
      return Promise.all(
        accounts.map((account) => {
          const connectionUri = `${config.baseUrl}/v1/accounts/${account.resourceId}/balances`;

          return ajaxPromise({
            url: connectionUri,
            dataType: "json",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }).then((data) => ({
            account,
            balances: data.balances.map((b) => ({
              ...b,
              resourceId: account.resourceId,
              balanceAmount: b.balanceAmount.amount,
              balanceCurrency: b.balanceAmount.currency,
              originalObject: JSON.stringify(b.originalObject),
            })),
          }));
        })
      ).then((balancesResultList) => {
        return balancesResultList.reduce((accumulator, currentValue) => {
          return [...accumulator, ...currentValue.balances];
        }, []);
      });
    });
  }

  function getTransactions(accessToken) {
    const accountsPromise = getAccounts(accessToken);

    return accountsPromise.then((accounts) => {
      return Promise.all(
        accounts.map((account) => {
          const connectionUri = `${config.baseUrl}/v1/accounts/${account.resourceId}/transactions`;

          return ajaxPromise({
            url: connectionUri,
            dataType: "json",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }).then((data) => ({
            account,
            transactions: data.transactions.map((b) => ({
              ...b,
              resourceId: account.resourceId,
              transactionAmount: b.transactionAmount.amount,
              transactionCurrency: b.transactionAmount.currency,
              originalObject: JSON.stringify(b.originalObject),
            })),
          }));
        })
      ).then((transactionsResultList) => {
        return transactionsResultList.reduce((accumulator, currentValue) => {
          return [...accumulator, ...currentValue.transactions];
        }, []);
      });
    });
  }

  // This function toggles the label shown depending
  // on whether or not the user has been authenticated
  function updateUIWithAuthState(hasAuth) {
    if (hasAuth) {
      $(".notsignedin").css("display", "none");
      $(".signedin").css("display", "block");
    } else {
      $(".notsignedin").css("display", "block");
      $(".signedin").css("display", "none");
    }
  }

  function updateAccessToken(accessToken) {
    const hasAuth = (accessToken && accessToken.length > 0);

    // If we are not in the data gathering phase, we want to store the token
    // This allows us to access the token in the data gathering phase
    if (tableau.phase == tableau.phaseEnum.interactivePhase || tableau.phase == tableau.phaseEnum.authPhase) {
      if (hasAuth) {
        tableau.password = accessToken;

        if (tableau.phase == tableau.phaseEnum.authPhase) {
          // Auto-submit here if we are in the auth phase
          tableau.submit();
        }

        return;
      }
    }
  }

  //------------- Tableau WDC code -------------//
  // Create tableau connector, should be called first
  var myConnector = tableau.makeConnector();

  // Init function for connector, called during every phase but
  // only called when running inside the simulator or tableau
  myConnector.init = function (initCallback) {
    tableau.authType = tableau.authTypeEnum.custom;
    console.log("tableau", tableau.phase);

    // If we are in the auth phase we only want to show the UI needed for auth
    if (tableau.phase == tableau.phaseEnum.authPhase) {
      $("#getvenuesbutton").css("display", "none");
    }

    if (tableau.phase == tableau.phaseEnum.gatherDataPhase) {
      // If the API that WDC is using has an endpoint that checks
      // the validity of an access token, that could be used here.
      // Then the WDC can call tableau.abortForAuth if that access token
      // is invalid.
    }
    // var accessToken = Cookies.get("accessToken");
    var accessToken = null;

    const prefixed = Qs.parse(document.location.search, { ignoreQueryPrefix: true });

    if (prefixed.hasOwnProperty('code') && (tableau.phase == tableau.phaseEnum.interactivePhase || tableau.phase == tableau.phaseEnum.authPhase)) {
      const authCode = prefixed.code;

      var requestObject = {
          'client_id': config.clientId,
          'redirect_uri': config.redirectUri,
          'code': authCode,
          'grant_type': 'authorization_code',
          'code_verifier': 'exampleCodeVerifier0123456789012345678901234567890'
      };

      ajaxPromise({
        url: config.tokenUrl,
        method: "POST",
        data: requestObject,
        dataType: "json",
        headers: {
          'client-id': config.clientId,
        },
      }).then((data) => {
        var hasAuth = (data.access_token && data.access_token.length > 0)

        updateUIWithAuthState(hasAuth);

        initCallback();

        updateAccessToken(data.access_token);
      });
    } else {
      console.log("Access token is '" + accessToken + "'");
      var hasAuth = (accessToken && accessToken.length > 0) || tableau.password.length > 0;
      updateUIWithAuthState(hasAuth);

      initCallback();

      updateAccessToken(accessToken);
    }
  };

  // Declare the data to Tableau that we are returning from bankIO
  myConnector.getSchema = function (schemaCallback) {
    const accountsColumns = [
      { id: "resourceId", dataType: "string" },
      { id: "iban", dataType: "string" },
      { id: "product", dataType: "string" },
      { id: "currency", dataType: "string" },
      { id: "name", dataType: "string" },
      { id: "cashAccountType", dataType: "string" },
      { id: "originalObject", dataType: "string" },
    ];

    const accountsTableInfo = {
      id: "accounts",
      columns: accountsColumns,
    };

    const balancesColumns = [
      {
        id: "resourceId",
        dataType: "string",
        foreignKey: {
          tableId: "accounts",
          columnId: "resourceId",
        },
      },
      { id: "balanceType", dataType: "string" },
      { id: "creditDebitIndicator", dataType: "string" },
      { id: "referenceDate", dataType: "datetime" },
      { id: "balanceAmount", dataType: "float" },
      { id: "balanceCurrency", dataType: "string" },
      { id: "originalObject", dataType: "string" },
    ];

    const balancesTableInfo = {
      id: "balances",
      columns: balancesColumns,
    };

    const transactionsColumns = [
      {
        id: "resourceId",
        dataType: "string",
        foreignKey: {
          tableId: "accounts",
          columnId: "resourceId",
        },
      },
      { id: "transactionId", dataType: "string" },
      { id: "endToEndId", dataType: "string" },
      { id: "mandateId", dataType: "string" },
      { id: "checkId", dataType: "string" },
      { id: "creditorId", dataType: "string" },
      // { id: "currencyExchange", type nullable list},
      { id: "entryReference", dataType: "string" },
      { id: "ultimateCreditor", dataType: "string" },
      { id: "ultimateDebtor", dataType: "string" },
      { id: "remittanceInformationUnstructured", dataType: "string" },
      // { id: "remittanceInformationUnstructuredArray", type nullable list},
      // { id: "remittanceInformationStructured", RemittanceInformationStructuredType },
      // { id: "remittanceInformationStructuredArray", type nullable list},
      { id: "bookingDate", dataType: "datetime" },
      { id: "valueDate", dataType: "datetime" },
      { id: "transactionAmount", dataType: "float" },
      { id: "transactionCurrency", dataType: "string" },
      { id: "transactionStatus", dataType: "string" },
      { id: "creditorName", dataType: "string" },
      { id: "debtorName", dataType: "string" },
      { id: "creditorAgent", dataType: "string" },
      { id: "debtorAgent", dataType: "string" },
      { id: "creditorAccount", dataType: "string" },
      { id: "debtorAccount", dataType: "string" },
      { id: "additionalInformation", dataType: "string" },
      { id: "purposeCode", dataType: "string" },
      { id: "bankTransactionCode", dataType: "string" },
      { id: "proprietaryBankTransactionCode", dataType: "string" },
      // { id: "balanceAfterTransaction", BalanceType},
      { id: "originalObject", dataType: "string" },
    ];

    const transactionsTableInfo = {
      id: "transactions",
      columns: transactionsColumns,
    };

    schemaCallback([accountsTableInfo, balancesTableInfo, transactionsTableInfo]);
  };

  // This function actually make the bankio API call and
  // parses the results and passes them back to Tableau
  myConnector.getData = function (table, doneCallback) {
    var accessToken = tableau.password;
    var promise = null;

    if (table.tableInfo.id == "accounts") {
      promise = getAccounts(accessToken);
    } else if (table.tableInfo.id == "balances") {
      promise = getBalances(accessToken);
    } else if (table.tableInfo.id == "transactions") {
      promise = getTransactions(accessToken);
    }

    promise
      .then(function (data) {
        if (data) {
          table.appendRows(data);
          doneCallback();
        } else {
          tableau.abortWithError("No results found");
        }
      })
      .catch(function (error) {
        // WDC should do more granular error checking here
        // or on the server side.  This is just a sample of new API.
        tableau.abortForAuth("Invalid Access Token");
      });
  };

  // Register the tableau connector, call this last
  tableau.registerConnector(myConnector);
})();
