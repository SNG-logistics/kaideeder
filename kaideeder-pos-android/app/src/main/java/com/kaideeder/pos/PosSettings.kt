package com.kaideeder.pos

import android.net.Uri

class PosSettings {
    val posBaseUrl: String = BuildConfig.POS_BASE_URL
    val cashDrawerEnabled: Boolean = BuildConfig.CASH_DRAWER_ENABLED

    private val allowedHosts = csvSet(BuildConfig.ALLOWED_HOSTS)
    private val allowedAssetHosts = csvSet(BuildConfig.ALLOWED_ASSET_HOSTS)

    init {
        require(isTrustedPosUri(Uri.parse(posBaseUrl))) {
            "POS_BASE_URL must use an allowed host and an approved scheme"
        }
    }

    fun isTrustedPosUri(uri: Uri): Boolean {
        val host = uri.host?.lowercase() ?: return false
        val schemeAllowed = uri.scheme == "https" ||
            (BuildConfig.DEBUG && BuildConfig.ALLOW_CLEARTEXT && uri.scheme == "http")
        return schemeAllowed && host in allowedHosts
    }

    fun isTrustedAssetUri(uri: Uri): Boolean {
        val host = uri.host?.lowercase() ?: return false
        return uri.scheme == "https" && host in allowedAssetHosts
    }

    private fun csvSet(value: String): Set<String> = value.split(',')
        .map { it.trim().lowercase() }
        .filter { it.isNotBlank() }
        .toSet()
}
